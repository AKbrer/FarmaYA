package com.farmaya.service;

import static com.farmaya.model.OrderStatus.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;

import com.farmaya.config.FarmaYaProperties;
import com.farmaya.model.Dtos.ConfirmItem;
import com.farmaya.model.Dtos.ConfirmRequest;
import com.farmaya.model.Dtos.CreateOrderRequest;
import com.farmaya.model.Dtos.ItemRequest;
import com.farmaya.model.Order;
import com.farmaya.model.Order.ConfirmedItem;
import com.farmaya.model.Order.HistoryEntry;
import com.farmaya.model.OrderStatus;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.repo.OrderRepository;
import com.farmaya.web.ApiException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Reglas del negocio de FarmaYa.
 *
 * Toda asignación (farmacia o repartidor) y toda transición de estado se hace con
 * findAndModify condicionado al estado actual. MongoDB lo ejecuta de forma atómica,
 * así que si dos farmacias (o dos repartidores) aceptan al mismo tiempo, solo una gana.
 */
@Service
public class OrderService {
    private static final SecureRandom RND = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final FindAndModifyOptions NEW = FindAndModifyOptions.options().returnNew(true);

    private static final List<OrderStatus> CLIENT_CANCELABLE =
            List.of(BUSCANDO_FARMACIA, FARMACIA_ASIGNADA, PRECIO_POR_ACEPTAR, PRECIO_CONFIRMADO);
    private static final List<OrderStatus> ACTIVE_DELIVERY = List.of(REPARTIDOR_ASIGNADO, PEDIDO_RECOGIDO, EN_CAMINO);
    private static final List<OrderStatus> NO_INCIDENT = List.of(CANCELADA, VENCIDA, RECHAZADA, CON_INCIDENCIA);
    private static final List<OrderStatus> FINAL = List.of(ENTREGADO, CANCELADA, VENCIDA, RECHAZADA);

    private final MongoTemplate mongo;
    private final OrderRepository orders;
    private final FarmaYaProperties props;
    private final MovementService movements;

    public OrderService(MongoTemplate mongo, OrderRepository orders, FarmaYaProperties props, MovementService movements) {
        this.mongo = mongo;
        this.orders = orders;
        this.props = props;
        this.movements = movements;
    }

    // =====================================================================
    // Cliente
    // =====================================================================

    public Order create(User client, CreateOrderRequest r) {
        if (r.items() == null || r.items().isEmpty()) throw ApiException.bad("Agrega al menos un producto.");
        if (r.items().size() > 30) throw ApiException.bad("Un pedido puede tener hasta 30 productos.");
        String address = clean(r.address(), 200);
        if (blank(address) || address.length() < 5) throw ApiException.bad("Escribe la dirección de entrega completa.");
        String city = clean(r.city(), 100);
        if (blank(city)) city = clean(r.zone(), 100);
        String zone = blank(city) ? client.zone : city;
        if (r.latitude() != null && (r.latitude() < -90 || r.latitude() > 90)) throw ApiException.bad("Latitud inválida.");
        if (r.longitude() != null && (r.longitude() < -180 || r.longitude() > 180)) throw ApiException.bad("Longitud inválida.");

        Order o = new Order();
        for (ItemRequest it : r.items()) {
            String name = clean(it.name(), 120);
            int qty = it.quantity() == null ? 1 : it.quantity();
            if (blank(name)) throw ApiException.bad("Cada producto necesita un nombre.");
            if (qty < 1 || qty > 99) throw ApiException.bad("La cantidad de «" + name + "» debe estar entre 1 y 99.");
            o.items.add(new Order.Item(name, qty, Boolean.TRUE.equals(it.prescription()), clean(it.note(), 200)));
        }

        Instant now = Instant.now();
        o.clientId = client.id;
        o.clientName = client.name;
        o.clientPhone = blank(r.phone()) ? client.phone : clean(r.phone(), 30);
        o.address = address;
        o.zone = zone;
        o.city = city;
        o.latitude = r.latitude();
        o.longitude = r.longitude();
        o.notes = clean(r.notes(), 400);
        o.deliveryCode = String.format("%04d", RND.nextInt(10_000));
        o.status = BUSCANDO_FARMACIA;
        o.searchStartedAt = now;
        o.createdAt = now;
        o.updatedAt = now;
        o.history.add(new HistoryEntry(SOLICITUD_ENVIADA, client, "Solicitud enviada"));
        o.history.add(new HistoryEntry(BUSCANDO_FARMACIA, null, "Buscando farmacias cercanas a tu ubicación"));

        for (int i = 0; i < 5; i++) {
            o.code = newCode();
            try {
                Order saved = orders.save(o);
                for (HistoryEntry event : saved.history) movements.recordOrderEvent(saved, event);
                return present(saved, client);
            } catch (DuplicateKeyException e) {
                // código repetido: se reintenta con otro
            }
        }
        throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "No pudimos crear el pedido. Intenta de nuevo.");
    }

    public List<Order> listForClient(User client) {
        return orders.findTop100ByClientIdOrderByCreatedAtDesc(client.id).stream().map(o -> present(o, client)).toList();
    }

    public Order acceptPrice(String id, User client) {
        ownedByClient(id, client);
        Criteria c = where("id").is(id).and("clientId").is(client.id).and("status").is(PRECIO_POR_ACEPTAR);
        Update u = step(PRECIO_CONFIRMADO, client, "El cliente aceptó el precio final");
        return present(apply(c, u, "Este pedido ya no está esperando tu confirmación de precio."), client);
    }

    public Order declinePrice(String id, User client) {
        Order o = ownedByClient(id, client);
        if (o.status != PRECIO_POR_ACEPTAR) throw ApiException.conflict("Este pedido ya no está esperando tu confirmación de precio.");
        Criteria c = where("id").is(id).and("clientId").is(client.id).and("status").is(PRECIO_POR_ACEPTAR);
        Update u = backToSearch(step(BUSCANDO_FARMACIA, client, "El cliente no aceptó el precio. Buscamos otra farmacia."), o.pharmacyId);
        return present(apply(c, u, "Este pedido ya no está esperando tu confirmación de precio."), client);
    }

    public Order cancelByClient(String id, User client) {
        ownedByClient(id, client);
        Criteria c = where("id").is(id).and("clientId").is(client.id).and("status").in(CLIENT_CANCELABLE);
        Update u = step(CANCELADA, client, "Cancelado por el cliente");
        return present(apply(c, u,
                "Ya no puedes cancelar: la farmacia está preparando el pedido o ya va en camino. Si hay un problema, repórtalo."), client);
    }

    // =====================================================================
    // Farmacia
    // =====================================================================

    /** Motivo por el que la farmacia no puede recibir pedidos ahora, o null si puede. */
    public String pharmacyBlockReason(User ph) {
        if (!ph.verified) return "Tu farmacia aún no ha sido verificada por un administrador.";
        if (!ph.active) return "Estás en pausa. Activa «Recibiendo pedidos» para ver solicitudes.";
        if (!isOpenNow(ph)) return "Estás fuera de tu horario de atención (" + ph.openFrom + " a " + ph.openTo + ").";
        return null;
    }

    public List<Order> offersForPharmacy(User ph) {
        if (pharmacyBlockReason(ph) != null) return List.of();
        Query q = new Query(pharmacyOffers(ph, null)).with(Sort.by(Sort.Direction.ASC, "createdAt")).limit(50);
        return mongo.find(q, Order.class).stream()
                .filter(o -> isPharmacyEligible(o, ph))
                .map(o -> present(o, ph)).toList();
    }

    public List<Order> mineForPharmacy(User ph) {
        Query q = new Query(where("pharmacyId").is(ph.id)).with(Sort.by(Sort.Direction.DESC, "updatedAt")).limit(100);
        return mongo.find(q, Order.class).stream().map(o -> present(o, ph)).toList();
    }

    /** La primera farmacia elegible que llegue aquí se queda con el pedido. */
    public Order acceptByPharmacy(String id, User ph) {
        String reason = pharmacyBlockReason(ph);
        if (reason != null) throw ApiException.forbidden(reason);
        Order current = get(id);
        if (!isPharmacyEligible(current, ph)) {
            throw ApiException.bad("El pedido está fuera del radio de cobertura para esta etapa de búsqueda.");
        }
        Double distanceKm = estimatedRoadDistanceKm(ph.latitude, ph.longitude, current.latitude, current.longitude);
        Update u = step(FARMACIA_ASIGNADA, ph, "La farmacia aceptó el pedido")
                .set("pharmacyId", ph.id)
                .set("pharmacyName", ph.pharmacyName)
                .set("pharmacyAddress", ph.address)
                .set("pharmacyLatitude", ph.latitude)
                .set("pharmacyLongitude", ph.longitude)
                .set("pharmacyZone", ph.zone)
                .set("assignedAt", Instant.now());
        if (distanceKm != null) {
            u.set("deliveryDistanceKm", distanceKm)
             .set("courierEarnings", courierFee(distanceKm));
        }
        return present(apply(pharmacyOffers(ph, id), u, "Otra farmacia ya tomó este pedido o dejó de estar disponible."), ph);
    }

    /** La farmacia descarta una solicitud: deja de verla, pero el pedido sigue buscando. */
    public void rejectOffer(String id, User ph) {
        mongo.updateFirst(new Query(where("id").is(id).and("status").is(BUSCANDO_FARMACIA)),
                new Update().addToSet("rejectedPharmacies", ph.id), Order.class);
    }

    /** La farmacia asignada descubre que no puede surtir el pedido. */
    public Order releaseByPharmacy(String id, User ph) {
        Criteria c = where("id").is(id).and("pharmacyId").is(ph.id).and("status").is(FARMACIA_ASIGNADA);
        Update u = backToSearch(step(BUSCANDO_FARMACIA, ph, "La farmacia no pudo surtir el pedido. Buscamos otra."), ph.id);
        return present(apply(c, u, "Ya no puedes liberar este pedido."), ph);
    }

    public Order confirmPrices(String id, User ph, ConfirmRequest r) {
        Order o = get(id);
        if (!ph.id.equals(o.pharmacyId) || o.status != FARMACIA_ASIGNADA)
            throw ApiException.conflict("Este pedido ya no está esperando tu confirmación de precios.");
        if (r.items() == null || r.items().isEmpty()) throw ApiException.bad("Indica la disponibilidad de los productos.");

        List<ConfirmedItem> list = new ArrayList<>();
        double total = 0;
        int available = 0;
        for (ConfirmItem ci : r.items()) {
            String name = clean(ci.name(), 120);
            boolean av = Boolean.TRUE.equals(ci.available());
            int qty = 0;
            double price = 0;
            if (av) {
                qty = ci.quantity() == null ? 0 : ci.quantity();
                price = ci.unitPrice() == null ? -1 : ci.unitPrice();
                if (qty < 1 || qty > 99) throw ApiException.bad("Revisa la cantidad de «" + name + "».");
                if (price < 0 || price > 100_000_000) throw ApiException.bad("Revisa el precio de «" + name + "».");
                available++;
                total += qty * price;
            }
            list.add(new ConfirmedItem(name, qty, price, av));
        }
        if (available == 0) throw ApiException.bad("Si no tienes ninguno de los productos, usa «No puedo surtir este pedido».");
        int prep = r.prepMinutes() == null ? 20 : r.prepMinutes();
        if (prep < 1 || prep > 240) throw ApiException.bad("El tiempo de preparación debe estar entre 1 y 240 minutos.");

        Update u = step(PRECIO_POR_ACEPTAR, ph, "La farmacia confirmó existencias y precio")
                .set("confirmedItems", list)
                .set("total", Math.round(total * 100) / 100.0)
                .set("prepMinutes", prep)
                .set("pharmacyNote", clean(r.note(), 300))
                .set("priceAskedAt", Instant.now());
        Criteria c = where("id").is(id).and("pharmacyId").is(ph.id).and("status").is(FARMACIA_ASIGNADA);
        return present(apply(c, u, "Este pedido ya no está esperando tu confirmación de precios."), ph);
    }

    public Order startPreparation(String id, User ph) {
        Criteria c = where("id").is(id).and("pharmacyId").is(ph.id).and("status").is(PRECIO_CONFIRMADO);
        return present(apply(c, step(PEDIDO_EN_PREPARACION, ph, "La farmacia empezó a preparar el pedido"),
                "El cliente aún no ha aceptado el precio."), ph);
    }

    public Order markReady(String id, User ph) {
        Instant now = Instant.now();
        Update u = new Update().set("status", BUSCANDO_REPARTIDOR).set("updatedAt", now)
                .set("courierSearchStartedAt", now).set("courierRound", 1);
        u.push("history").each(
                new HistoryEntry(PEDIDO_LISTO, ph, "Pedido listo para recoger"),
                new HistoryEntry(BUSCANDO_REPARTIDOR, null, "Buscando un repartidor disponible"));
        Criteria c = where("id").is(id).and("pharmacyId").is(ph.id).and("status").is(PEDIDO_EN_PREPARACION);
        return present(apply(c, u, "Primero debes empezar la preparación del pedido."), ph);
    }

    // =====================================================================
    // Repartidor
    // =====================================================================

    public String courierBlockReason(User c) {
        if (!c.verified) return "Tu cuenta aún no ha sido verificada por un administrador.";
        if (!c.active) return "Estás en pausa. Activa «Disponible» para ver entregas.";
        long active = mongo.count(new Query(where("courierId").is(c.id).and("status").in(ACTIVE_DELIVERY)), Order.class);
        if (active >= props.maxActiveDeliveries())
            return "Ya tienes " + active + " entregas en curso. Termina una para aceptar otra.";
        return null;
    }

    public List<Order> offersForCourier(User c) {
        if (courierBlockReason(c) != null) return List.of();
        Query q = new Query(courierOffers(c, null)).with(Sort.by(Sort.Direction.ASC, "courierSearchStartedAt")).limit(50);
        return mongo.find(q, Order.class).stream()
                .filter(o -> isCourierEligible(o, c))
                .map(o -> present(o, c)).toList();
    }

    public List<Order> mineForCourier(User c) {
        Query q = new Query(where("courierId").is(c.id)).with(Sort.by(Sort.Direction.DESC, "updatedAt")).limit(100);
        return mongo.find(q, Order.class).stream().map(o -> present(o, c)).toList();
    }

    /** El primer repartidor elegible que acepte se queda con la entrega. */
    public Order acceptByCourier(String id, User c) {
        String reason = courierBlockReason(c);
        if (reason != null) throw ApiException.forbidden(reason);
        Order current = get(id);
        if (!isCourierEligible(current, c)) {
            throw ApiException.bad("Esta entrega está fuera del radio de cobertura o ya fue asignada.");
        }
        Update u = step(REPARTIDOR_ASIGNADO, c, "Repartidor asignado")
                .set("courierId", c.id).set("courierName", c.name).set("courierPhone", c.phone);
        return present(apply(courierOffers(c, id), u, "Otro repartidor ya tomó esta entrega o dejó de estar disponible."), c);
    }

    public Order releaseByCourier(String id, User c) {
        Update u = step(BUSCANDO_REPARTIDOR, c, "El repartidor canceló la entrega. Buscamos otro.")
                .addToSet("rejectedCouriers", c.id)
                .unset("courierId").unset("courierName").unset("courierPhone")
                .set("courierSearchStartedAt", Instant.now()).set("courierRound", 1);
        Criteria cr = where("id").is(id).and("courierId").is(c.id).and("status").is(REPARTIDOR_ASIGNADO);
        return present(apply(cr, u, "Ya no puedes cancelar esta entrega. Si hay un problema, repórtalo."), c);
    }

    public Order pickup(String id, User c) {
        Criteria cr = where("id").is(id).and("courierId").is(c.id).and("status").is(REPARTIDOR_ASIGNADO);
        return present(apply(cr, step(PEDIDO_RECOGIDO, c, "El repartidor recogió el pedido"), "Esta entrega no está lista para recoger."), c);
    }

    public Order onTheWay(String id, User c) {
        Criteria cr = where("id").is(id).and("courierId").is(c.id).and("status").is(PEDIDO_RECOGIDO);
        return present(apply(cr, step(EN_CAMINO, c, "El repartidor va hacia la dirección del cliente"),
                "Primero debes marcar el pedido como recogido."), c);
    }

    public Order deliver(String id, User c, String code) {
        Order o = get(id);
        if (!c.id.equals(o.courierId)) throw ApiException.forbidden("Esta entrega no está asignada a ti.");
        if (o.status != EN_CAMINO) throw ApiException.conflict("Primero marca el pedido como «En camino».");
        if (o.codeAttempts >= 5) throw ApiException.forbidden("Superaste los intentos permitidos. Reporta una incidencia.");
        if (blank(code) || !o.deliveryCode.equals(code.trim())) {
            mongo.updateFirst(new Query(where("id").is(id)), new Update().inc("codeAttempts", 1), Order.class);
            throw ApiException.bad("El código no coincide. Pídele al cliente su código de 4 dígitos.");
        }
        Criteria cr = where("id").is(id).and("courierId").is(c.id).and("status").is(EN_CAMINO);
        Instant deliveredAt = Instant.now();
        Update u = step(ENTREGADO, c, "Entrega confirmada con el código del cliente").set("deliveredAt", deliveredAt);
        Double distanceKm = estimatedRoadDistanceKm(o.pharmacyLatitude, o.pharmacyLongitude, o.latitude, o.longitude);
        if (distanceKm != null) {
            u.set("deliveryDistanceKm", distanceKm)
             .set("courierEarnings", courierFee(distanceKm));
        }
        return present(apply(cr, u, "Esta entrega ya fue completada."), c);
    }

    /**
     * Estima distancia vial usando distancia geodésica * 1.3 (factor aproximado de desvío urbano).
     * Tarifa: COP $2.000 de base + $1.000 por cada kilómetro iniciado; mínimo $3.000.
     * La tarifa se congela en el pedido cuando la entrega queda confirmada.
     */
    public static Double estimatedRoadDistanceKm(Double fromLat, Double fromLon, Double toLat, Double toLon) {
        if (fromLat == null || fromLon == null || toLat == null || toLon == null) return null;
        double earthKm = 6371.0088;
        double lat1 = Math.toRadians(fromLat), lat2 = Math.toRadians(toLat);
        double dLat = lat2 - lat1, dLon = Math.toRadians(toLon - fromLon);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double straight = 2 * earthKm * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
        return Math.round(straight * 1.3 * 10.0) / 10.0;
    }

    public static double courierFee(double estimatedRoadKm) {
        return Math.max(3000, 2000 + Math.ceil(estimatedRoadKm) * 1000);
    }

    /**
     * Valida si un pedido está dentro del radio de alcance para la farmacia según la ronda de búsqueda.
     * Ronda 1: radio cercano (<= 6 km)
     * Ronda 2: radio ampliado (<= 15 km)
     * Ronda 3+: radio extendido (<= 30 km)
     */
    public boolean isPharmacyEligible(Order o, User ph) {
        if (o.status != BUSCANDO_FARMACIA) return false;
        if (o.rejectedPharmacies != null && o.rejectedPharmacies.contains(ph.id)) return false;
        if (ph.latitude == null || ph.longitude == null || o.latitude == null || o.longitude == null) {
            return true; // Fallback si no hay geolocalización
        }
        Double dist = estimatedRoadDistanceKm(ph.latitude, ph.longitude, o.latitude, o.longitude);
        if (dist == null) return true;
        int round = o.searchRound <= 0 ? 1 : o.searchRound;
        if (round == 1) return dist <= 6.0;
        if (round == 2) return dist <= 15.0;
        return dist <= 30.0;
    }

    /**
     * Valida si una entrega está dentro del radio razonable para los domiciliarios.
     * Ronda 1: radio cercano / estándar (<= 10 km)
     * Ronda 2+: radio ampliado (<= 22 km, para que el domicilio no demore en llegar)
     */
    public boolean isCourierEligible(Order o, User c) {
        if (o.status != BUSCANDO_REPARTIDOR) return false;
        if (o.rejectedCouriers != null && o.rejectedCouriers.contains(c.id)) return false;
        Double dist = estimatedRoadDistanceKm(o.pharmacyLatitude, o.pharmacyLongitude, o.latitude, o.longitude);
        if (dist == null) return true;
        int round = o.courierRound <= 0 ? 1 : o.courierRound;
        if (round == 1) return dist <= 10.0;
        return dist <= 22.0;
    }

    // =====================================================================
    // Incidencias, consulta y administración
    // =====================================================================

    public Order reportIncident(String id, User user, String note) {
        Order o = get(id);
        boolean mine = switch (user.role) {
            case CLIENTE -> user.id.equals(o.clientId);
            case FARMACIA -> user.id.equals(o.pharmacyId);
            case REPARTIDOR -> user.id.equals(o.courierId);
            default -> false;
        };
        if (!mine) throw ApiException.forbidden("No puedes reportar un problema en este pedido.");
        String text = clean(note, 500);
        if (blank(text) || text.length() < 5) throw ApiException.bad("Cuéntanos qué pasó con al menos unas palabras.");
        Criteria c = where("id").is(id).and("status").nin(NO_INCIDENT);
        Update u = step(CON_INCIDENCIA, user, text)
                .set("statusBeforeIncident", o.status)
                .set("incidentNote", text)
                .set("incidentBy", user.name + " (" + user.role.name().toLowerCase() + ")");
        return present(apply(c, u, "Este pedido ya no admite reportes."), user);
    }

    public Order resolveIncident(String id, User admin, String action, String note) {
        Order o = get(id);
        if (o.status != CON_INCIDENCIA) throw ApiException.conflict("Este pedido no tiene una incidencia abierta.");
        Criteria c = where("id").is(id).and("status").is(CON_INCIDENCIA);
        String extra = blank(note) ? "" : " " + clean(note, 300);
        Update u;
        if ("CANCELAR".equalsIgnoreCase(action)) {
            u = step(CANCELADA, admin, "Incidencia resuelta: pedido cancelado." + extra);
        } else if ("RESTAURAR".equalsIgnoreCase(action)) {
            OrderStatus back = o.statusBeforeIncident != null ? o.statusBeforeIncident : EN_CAMINO;
            u = step(back, admin, "Incidencia resuelta: el pedido continúa." + extra).unset("statusBeforeIncident");
        } else {
            throw ApiException.bad("Acción no válida.");
        }
        return present(apply(c, u, "La incidencia ya fue resuelta."), admin);
    }

    public Order cancelByAdmin(String id, User admin, String note) {
        Criteria c = where("id").is(id).and("status").nin(FINAL);
        String extra = blank(note) ? "" : " " + clean(note, 300);
        return present(apply(c, step(CANCELADA, admin, "Cancelado por la administración." + extra), "Este pedido ya finalizó."), admin);
    }

    public Order get(String id, User viewer) {
        Order o = get(id);
        boolean ok = switch (viewer.role) {
            case ADMIN -> true;
            case CLIENTE -> viewer.id.equals(o.clientId);
            case FARMACIA -> viewer.id.equals(o.pharmacyId);
            case REPARTIDOR -> viewer.id.equals(o.courierId);
        };
        if (!ok) throw ApiException.notFound("Pedido no encontrado.");
        return present(o, viewer);
    }

    public List<Order> listForAdmin(String status) {
        Query q = new Query();
        if (!blank(status)) {
            try {
                q.addCriteria(where("status").is(OrderStatus.valueOf(status)));
            } catch (IllegalArgumentException e) {
                throw ApiException.bad("Estado no válido.");
            }
        }
        q.with(Sort.by(Sort.Direction.DESC, "updatedAt")).limit(200);
        User admin = new User();
        admin.role = Role.ADMIN;
        return mongo.find(q, Order.class).stream().map(o -> present(o, admin)).toList();
    }

    // =====================================================================
    // Tareas programadas: ampliar búsquedas y vencer solicitudes
    // =====================================================================

    public void sweep() {
        Instant now = Instant.now();

        // 1) Nadie aceptó: se amplía el radio y se reenvía; si se agotan las rondas, vence.
        Query q1 = new Query(where("status").is(BUSCANDO_FARMACIA)
                .and("searchStartedAt").lt(now.minusSeconds(props.searchTimeoutSeconds())));
        for (Order o : mongo.find(q1, Order.class)) {
            Criteria same = where("id").is(o.id).and("status").is(BUSCANDO_FARMACIA).and("searchRound").is(o.searchRound);
            if (o.searchRound < props.maxSearchRounds()) {
                Update u = step(BUSCANDO_FARMACIA, null, "Ampliamos el radio de búsqueda a farmacias más lejanas.")
                        .set("searchRound", o.searchRound + 1).set("searchStartedAt", now);
                recordScheduledUpdate(mongo.findAndModify(new Query(same), u, Order.class), o.history.size());
            } else {
                recordScheduledUpdate(mongo.findAndModify(new Query(same),
                        step(VENCIDA, null, "Ninguna farmacia disponible dentro del rango aceptó el pedido a tiempo."), Order.class), o.history.size());
            }
        }

        // 2) La farmacia aceptó pero no confirmó precios: el pedido vuelve a buscarse.
        Query q2 = new Query(where("status").is(FARMACIA_ASIGNADA)
                .and("assignedAt").lt(now.minusSeconds(props.pharmacyConfirmTimeoutSeconds())));
        for (Order o : mongo.find(q2, Order.class)) {
            Criteria same = where("id").is(o.id).and("status").is(FARMACIA_ASIGNADA).and("pharmacyId").is(o.pharmacyId);
            Update u = backToSearch(step(BUSCANDO_FARMACIA, null, "La farmacia no confirmó a tiempo. Buscamos otra."), o.pharmacyId);
            recordScheduledUpdate(mongo.findAndModify(new Query(same), u, Order.class), o.history.size());
        }

        // 3) El cliente no respondió al precio.
        Query q3 = new Query(where("status").is(PRECIO_POR_ACEPTAR)
                .and("priceAskedAt").lt(now.minusSeconds(props.priceAcceptTimeoutSeconds())));
        for (Order o : mongo.find(q3, Order.class)) {
            Criteria same = where("id").is(o.id).and("status").is(PRECIO_POR_ACEPTAR);
            recordScheduledUpdate(mongo.findAndModify(new Query(same),
                    step(VENCIDA, null, "El precio no fue aceptado a tiempo."), Order.class), o.history.size());
        }

        // 4) Sin repartidor cercano: se amplía el radio de cobertura a repartidores de la ciudad.
        Query q4 = new Query(where("status").is(BUSCANDO_REPARTIDOR).and("courierRound").is(1)
                .and("courierSearchStartedAt").lt(now.minusSeconds(props.searchTimeoutSeconds())));
        for (Order o : mongo.find(q4, Order.class)) {
            Criteria same = where("id").is(o.id).and("status").is(BUSCANDO_REPARTIDOR).and("courierRound").is(1);
            Update u = step(BUSCANDO_REPARTIDOR, null, "Ampliamos el radio de búsqueda a más repartidores.")
                    .set("courierRound", 2).set("courierSearchStartedAt", now);
            recordScheduledUpdate(mongo.findAndModify(new Query(same), u, Order.class), o.history.size());
        }
    }

    // =====================================================================
    // Utilidades internas
    // =====================================================================

    private Order get(String id) {
        return orders.findById(id).orElseThrow(() -> ApiException.notFound("Pedido no encontrado."));
    }

    private Order ownedByClient(String id, User client) {
        Order o = get(id);
        if (!client.id.equals(o.clientId)) throw ApiException.notFound("Pedido no encontrado.");
        return o;
    }

    /** Cambio de estado + registro en el historial. */
    private Update step(OrderStatus to, User actor, String note) {
        return new Update().set("status", to).set("updatedAt", Instant.now())
                .push("history", new HistoryEntry(to, actor, note));
    }

    private void recordScheduledUpdate(Order updated, int previousHistorySize) {
        if (updated == null || updated.history == null) return;
        int start = Math.min(Math.max(0, previousHistorySize), updated.history.size());
        for (int i = start; i < updated.history.size(); i++) movements.recordOrderEvent(updated, updated.history.get(i));
    }

    /** Aplica la actualización de forma atómica; si el estado ya cambió, informa el conflicto. */
    private Order apply(Criteria c, Update u, String conflictMessage) {
        Order r = mongo.findAndModify(new Query(c), u, NEW, Order.class);
        if (r == null) throw ApiException.conflict(conflictMessage);
        int appended = 1;
        Object push = u.getUpdateObject().get("$push");
        if (push instanceof org.bson.Document d && d.containsKey("history")) {
            Object value = d.get("history");
            if (value instanceof org.bson.Document each && each.get("$each") instanceof List<?> list) appended = list.size();
        }
        recordScheduledUpdate(r, Math.max(0, r.history.size() - appended));
        return r;
    }

    /** Devuelve el pedido a la búsqueda de farmacia, excluyendo a la que no pudo atenderlo. */
    private Update backToSearch(Update u, String rejectedPharmacyId) {
        if (rejectedPharmacyId != null) u.addToSet("rejectedPharmacies", rejectedPharmacyId);
        return u.unset("pharmacyId").unset("pharmacyName").unset("pharmacyAddress").unset("pharmacyLatitude").unset("pharmacyLongitude").unset("pharmacyZone")
                .unset("confirmedItems").unset("total").unset("prepMinutes").unset("pharmacyNote")
                .unset("assignedAt").unset("priceAskedAt")
                .set("searchStartedAt", Instant.now()).set("searchRound", 1);
    }

    /** Pedidos que una farmacia puede ver/aceptar: elegibles por estado y no descartados. */
    private Criteria pharmacyOffers(User ph, String id) {
        Criteria base = where("status").is(BUSCANDO_FARMACIA).and("rejectedPharmacies").ne(ph.id);
        if (id != null) base = base.and("id").is(id);
        return base;
    }

    /** Pedidos que un repartidor puede ver/aceptar: elegibles por estado y no descartados. */
    private Criteria courierOffers(User c, String id) {
        Criteria base = where("status").is(BUSCANDO_REPARTIDOR).and("rejectedCouriers").ne(c.id);
        if (id != null) base = base.and("id").is(id);
        return base;
    }

    /**
     * Oculta datos según quién consulta (privacidad):
     * - Nadie fuera del cliente y la administración ve el código de entrega.
     * - La farmacia ve la dirección del cliente solo cuando el pedido ya es suyo, y nunca su teléfono.
     * - El repartidor no ve qué medicamentos son; ve dirección y contacto solo cuando la entrega es suya.
     */
    private Order present(Order o, User v) {
        if (v.role == Role.FARMACIA || v.role == Role.REPARTIDOR) o.deliveryCode = null;
        if (v.role == Role.FARMACIA) {
            if (!v.id.equals(o.pharmacyId)) o.address = null;
            o.clientPhone = null;
        }
        if (v.role == Role.REPARTIDOR) {
            o.itemCount = o.items.size();
            o.items = new ArrayList<>();
            o.confirmedItems = new ArrayList<>();
            if (!v.id.equals(o.courierId)) {
                o.address = null;
                o.clientName = null;
                o.clientPhone = null;
            }
        }
        return o;
    }

    public boolean isOpenNow(User ph) {
        try {
            if (blank(ph.openFrom) || blank(ph.openTo)) return true;
            LocalTime from = LocalTime.parse(ph.openFrom);
            LocalTime to = LocalTime.parse(ph.openTo);
            if (from.equals(to)) return true; // 24 horas
            LocalTime now = LocalTime.now(zone());
            return from.isBefore(to)
                    ? !now.isBefore(from) && !now.isAfter(to)
                    : !now.isBefore(from) || !now.isAfter(to); // horario que cruza la medianoche
        } catch (DateTimeParseException e) {
            return true;
        }
    }

    private ZoneId zone() {
        return blank(props.timezone()) ? ZoneId.systemDefault() : ZoneId.of(props.timezone());
    }

    private static String newCode() {
        StringBuilder sb = new StringBuilder("FY-");
        for (int i = 0; i < 6; i++) sb.append(ALPHABET.charAt(RND.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String clean(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
