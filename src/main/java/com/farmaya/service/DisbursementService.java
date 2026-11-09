package com.farmaya.service;

import com.farmaya.model.Disbursement;
import com.farmaya.model.Dtos.CreateDisbursementRequest;
import com.farmaya.model.Dtos.PharmacyPendingPayoutDto;
import com.farmaya.model.Order;
import com.farmaya.model.OrderStatus;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.repo.DisbursementRepository;
import com.farmaya.repo.UserRepository;
import com.farmaya.web.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Service
public class DisbursementService {
    private final MongoTemplate mongo;
    private final DisbursementRepository disbursements;
    private final UserRepository users;
    private final MovementService movements;

    public DisbursementService(MongoTemplate mongo, DisbursementRepository disbursements,
                               UserRepository users, MovementService movements) {
        this.mongo = mongo;
        this.disbursements = disbursements;
        this.users = users;
        this.movements = movements;
    }

    /**
     * Calcula los saldos acumulados pendientes de liquidación a farmacias aliadas (95% de ventas brutas).
     */
    public List<PharmacyPendingPayoutDto> getPendingPayouts() {
        // Pedidos entregados que aún no han sido desembolsados
        Query q = new Query(Criteria.where("status").is(OrderStatus.ENTREGADO)
                .and("disbursed").ne(true)
                .and("total").gt(0.0));
        q.fields().include("id", "code", "pharmacyId", "pharmacyName", "total", "platformEarnings");
        List<Order> pendingOrders = mongo.find(q, Order.class, "pedidos");

        if (pendingOrders.isEmpty()) return List.of();

        // Agrupar por pharmacyId
        Map<String, List<Order>> byPharmacy = pendingOrders.stream()
                .filter(o -> o.pharmacyId != null && !o.pharmacyId.isBlank())
                .collect(Collectors.groupingBy(o -> o.pharmacyId));

        if (byPharmacy.isEmpty()) return List.of();

        // Optimización por lotes: consultar todas las farmacias en un solo round-trip
        List<Object> idTargets = new ArrayList<>();
        for (String pid : byPharmacy.keySet()) {
            idTargets.add(pid);
            if (org.bson.types.ObjectId.isValid(pid)) {
                idTargets.add(new org.bson.types.ObjectId(pid));
            }
        }
        Query phQuery = new Query(Criteria.where("_id").in(idTargets));
        Map<String, User> phMap = new LinkedHashMap<>();
        for (User u : mongo.find(phQuery, User.class, "farmacias")) {
            if (u.id != null) phMap.put(u.id, u);
        }
        for (User u : mongo.find(phQuery, User.class, "users")) {
            if (u.id != null) phMap.putIfAbsent(u.id, u);
        }

        List<PharmacyPendingPayoutDto> result = new ArrayList<>();

        for (Map.Entry<String, List<Order>> entry : byPharmacy.entrySet()) {
            String phId = entry.getKey();
            List<Order> ordersList = entry.getValue();

            User ph = phMap.get(phId);
            String name = (ph != null && ph.pharmacyName != null) ? ph.pharmacyName : (ph != null ? ph.name : "Droguería Aliada");
            String email = ph != null ? ph.email : "";
            String phone = ph != null ? ph.phone : "";
            String address = ph != null ? ph.address : "";
            String city = ph != null ? ph.city : "Nacional";
            String bank = ph != null ? ph.bankName : "Por registrar";
            String accType = ph != null ? ph.accountType : "Ahorros";
            String accNum = ph != null ? ph.accountNumber : "Sin número registrado";
            String accHolder = ph != null ? ph.accountHolder : name;
            String accDoc = ph != null ? ph.accountDocNumber : "";

            double grossTotal = 0.0;
            List<String> ids = new ArrayList<>();
            List<String> codes = new ArrayList<>();

            for (Order o : ordersList) {
                double t = o.total != null ? o.total : 0.0;
                grossTotal += t;
                ids.add(o.id);
                if (o.code != null) codes.add(o.code);
            }

            double grossRounded = Math.round(grossTotal * 100.0) / 100.0;
            double fee5Pct = Math.round(grossRounded * 0.05 * 100.0) / 100.0;
            double netPayable = Math.round((grossRounded - fee5Pct) * 100.0) / 100.0;

            result.add(new PharmacyPendingPayoutDto(
                    phId, name, email, phone, address, city, bank, accType, accNum, accHolder, accDoc,
                    ordersList.size(), grossRounded, fee5Pct, netPayable, ids, codes
            ));
        }

        // Ordenar de mayor a menor saldo pendiente
        result.sort(Comparator.comparingDouble(PharmacyPendingPayoutDto::netPayable).reversed());
        return result;
    }

    /**
     * Ejecuta y asienta el desembolso a la cuenta bancaria de la farmacia aliada.
     */
    public Disbursement executeDisbursement(CreateDisbursementRequest req, User admin) {
        if (req == null || req.pharmacyId() == null || req.pharmacyId().isBlank()) {
            throw ApiException.bad("Debes especificar la farmacia aliada para liquidar.");
        }

        User ph = users.findById(req.pharmacyId())
                .orElseThrow(() -> ApiException.notFound("Farmacia no encontrada."));

        // Obtener los pedidos entregados no desembolsados
        Criteria crit = Criteria.where("status").is(OrderStatus.ENTREGADO)
                .and("pharmacyId").is(ph.id)
                .and("disbursed").ne(true);

        if (req.orderIds() != null && !req.orderIds().isEmpty()) {
            crit.and("id").in(req.orderIds());
        }

        List<Order> ordersToLiquidate = mongo.find(new Query(crit), Order.class, "pedidos");
        if (ordersToLiquidate.isEmpty()) {
            throw ApiException.bad("No hay pedidos entregados pendientes de liquidación para esta farmacia.");
        }

        double grossTotal = 0.0;
        List<String> orderIds = new ArrayList<>();
        List<String> orderCodes = new ArrayList<>();

        for (Order o : ordersToLiquidate) {
            double t = o.total != null ? o.total : 0.0;
            grossTotal += t;
            orderIds.add(o.id);
            if (o.code != null) orderCodes.add(o.code);
        }

        double grossRounded = Math.round(grossTotal * 100.0) / 100.0;
        double fee5Pct = Math.round(grossRounded * 0.05 * 100.0) / 100.0;
        double netAmount = Math.round((grossRounded - fee5Pct) * 100.0) / 100.0;

        String ref = (req.reference() != null && !req.reference().isBlank())
                ? req.reference().trim()
                : "TRANS-" + (System.currentTimeMillis() % 1000000);

        String method = (req.method() != null && !req.method().isBlank())
                ? req.method().trim()
                : "TRANSFERENCIA_BANCARIA";

        // Crear registro de liquidación
        Disbursement d = new Disbursement();
        long seq = disbursements.count() + 1;
        d.code = String.format("LIQ-2026-%05d", seq);
        d.pharmacyId = ph.id;
        d.pharmacyName = ph.pharmacyName != null ? ph.pharmacyName : ph.name;
        d.pharmacyEmail = ph.email;
        d.pharmacyPhone = ph.phone;
        d.pharmacyCity = ph.city != null ? ph.city : "Nacional";

        d.bankName = ph.bankName != null ? ph.bankName : "Bancolombia";
        d.accountType = ph.accountType != null ? ph.accountType : "Ahorros";
        d.accountNumber = ph.accountNumber != null ? ph.accountNumber : "Sin número registrado";
        d.accountHolder = ph.accountHolder != null ? ph.accountHolder : d.pharmacyName;
        d.accountDocNumber = ph.accountDocNumber != null ? ph.accountDocNumber : "";

        d.orderIds = orderIds;
        d.orderCodes = orderCodes;
        d.orderCount = orderIds.size();

        d.grossTotal = grossRounded;
        d.platformCommissionRate = 0.05;
        d.platformEarnings = fee5Pct;
        d.netAmount = netAmount;

        d.reference = ref;
        d.method = method;
        d.status = "COMPLETADO";
        d.notes = req.notes() != null ? req.notes().trim() : "Liquidación de ventas FarmaYA (95%)";
        d.disbursedBy = admin != null ? admin.name : "Administración FarmaYA";
        d.createdAt = Instant.now();

        Disbursement saved = disbursements.save(d);

        // Actualizar todos los pedidos incluidos a disbursed = true
        Instant now = Instant.now();
        Query updateQ = new Query(Criteria.where("id").in(orderIds));
        Update updateCmd = new Update()
                .set("disbursed", true)
                .set("disbursementId", saved.id)
                .set("disbursedAt", now);
        mongo.updateMulti(updateQ, updateCmd, "pedidos");

        // Registrar movimiento de auditoría
        try {
            movements.record("DESEMBOLSO_FARMACIA",
                    "Desembolso neto de $" + String.format("%,.0f", netAmount) + " COP transferido a la droguería "
                            + d.pharmacyName + " (" + d.bankName + " " + d.accountNumber + "). Comprobante: " + ref
                            + ". Retención FarmaYA (5%): $" + String.format("%,.0f", fee5Pct) + " COP.",
                    admin, null);
        } catch (Exception ignored) {}

        return saved;
    }

    /**
     * Lista todos los desembolsos históricos registrados en el sistema.
     */
    public List<Disbursement> listAll() {
        return disbursements.findAllByOrderByCreatedAtDesc();
    }

    /**
     * Resumen de liquidaciones para la farmacia en sesión.
     */
    public Map<String, Object> getPharmacyOverview(User pharmacy) {
        if (pharmacy == null || pharmacy.id == null) {
            throw ApiException.forbidden("Debes iniciar sesión como farmacia.");
        }

        // Pedidos pendientes de liquidar
        Query q = new Query(Criteria.where("status").is(OrderStatus.ENTREGADO)
                .and("pharmacyId").is(pharmacy.id)
                .and("disbursed").ne(true)
                .and("total").gt(0.0));
        q.fields().include("id", "code", "total");
        List<Order> pendingOrders = mongo.find(q, Order.class, "pedidos");

        double pendingGross = 0.0;
        for (Order o : pendingOrders) {
            pendingGross += (o.total != null ? o.total : 0.0);
        }
        double pendingGrossRounded = Math.round(pendingGross * 100.0) / 100.0;
        double pendingFee = Math.round(pendingGrossRounded * 0.05 * 100.0) / 100.0;
        double pendingNet = Math.round((pendingGrossRounded - pendingFee) * 100.0) / 100.0;

        List<Disbursement> history = disbursements.findByPharmacyIdOrderByCreatedAtDesc(pharmacy.id);

        double totalDisbursedHistoric = 0.0;
        for (Disbursement d : history) {
            totalDisbursedHistoric += (d.netAmount != null ? d.netAmount : 0.0);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("pendingOrdersCount", pendingOrders.size());
        res.put("pendingGross", pendingGrossRounded);
        res.put("pendingFee", pendingFee);
        res.put("pendingNet", pendingNet);
        res.put("totalDisbursedHistoric", Math.round(totalDisbursedHistoric * 100.0) / 100.0);
        res.put("bankConfigured", pharmacy.accountNumber != null && !pharmacy.accountNumber.isBlank());
        res.put("bankName", pharmacy.bankName);
        res.put("accountType", pharmacy.accountType);
        res.put("accountNumber", pharmacy.accountNumber);
        res.put("accountHolder", pharmacy.accountHolder);
        res.put("disbursements", history);

        return res;
    }
}
