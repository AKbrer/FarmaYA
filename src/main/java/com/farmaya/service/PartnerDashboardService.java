package com.farmaya.service;

import com.farmaya.model.Order;
import com.farmaya.model.OrderStatus;
import com.farmaya.model.User;
import com.farmaya.repo.UserRepository;
import java.util.HashMap;
import java.util.Set;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Locale;
import java.util.TreeMap;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

@Service
public class PartnerDashboardService {
    private static final ZoneId ZONE = ZoneId.of("America/Bogota");
    private final MongoTemplate mongo;
    private final UserRepository users;
    public PartnerDashboardService(MongoTemplate mongo, UserRepository users) {
        this.mongo = mongo;
        this.users = users;
    }

    public Map<String, Object> pharmacy(User user) {
        List<Order> orders = mongo.find(Query.query(Criteria.where("pharmacyId").is(user.id)).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(1000), Order.class);
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("today", pharmacyPeriod(orders, LocalDate.now(ZONE)));
        result.put("week", pharmacyPeriod(orders, LocalDate.now(ZONE).minusDays(6)));
        result.put("month", pharmacyPeriod(orders, LocalDate.now(ZONE).withDayOfMonth(1)));
        result.put("recentOrders", orders.stream().limit(5).map(o -> Map.of("code", o.code == null ? "—" : o.code, "status", o.status == null ? "—" : o.status.name(), "total", o.total == null ? 0 : o.total, "createdAt", o.createdAt == null ? Instant.EPOCH : o.createdAt)).toList());
        return result;
    }

    public Map<String,Object> pharmacyReport(User user, String fromText, String toText) {
        LocalDate from;
        LocalDate to;
        try {
            from = LocalDate.parse(fromText);
            to = LocalDate.parse(toText);
        } catch (DateTimeParseException | NullPointerException ex) {
            throw new IllegalArgumentException("Debes indicar una fecha inicial y final válidas.");
        }
        if (to.isBefore(from)) throw new IllegalArgumentException("La fecha final no puede ser anterior a la inicial.");
        if (java.time.temporal.ChronoUnit.DAYS.between(from, to) > 366) throw new IllegalArgumentException("El rango máximo permitido es de 367 días.");
        Instant start = from.atStartOfDay(ZONE).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(ZONE).toInstant();
        Criteria reportCriteria = new Criteria().and("pharmacyId").is(user.id).orOperator(
                Criteria.where("createdAt").gte(start).lt(end), Criteria.where("deliveredAt").gte(start).lt(end));
        List<Order> orders = mongo.find(Query.query(reportCriteria).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(5000), Order.class);
        List<Order> sales = orders.stream().filter(o -> o.status == OrderStatus.ENTREGADO && o.deliveredAt != null
                && !o.deliveredAt.isBefore(start) && o.deliveredAt.isBefore(end)).toList();
        double totalSales = sales.stream().mapToDouble(o -> o.total == null ? 0 : o.total).sum();
        Map<String, Long> quantities = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        Map<String, Double> amounts = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        for (Order order : sales) {
            if (order.confirmedItems != null && !order.confirmedItems.isEmpty()) {
                order.confirmedItems.stream().filter(i -> i.available && i.name != null && !i.name.isBlank()).forEach(i -> {
                    quantities.merge(i.name, (long) Math.max(0, i.quantity), Long::sum);
                    amounts.merge(i.name, Math.max(0, i.quantity) * Math.max(0, i.unitPrice), Double::sum);
                });
            } else if (order.items != null) {
                order.items.stream().filter(i -> i.name != null && !i.name.isBlank()).forEach(i -> {
                    quantities.merge(i.name, (long) Math.max(0, i.quantity), Long::sum);
                    amounts.putIfAbsent(i.name, 0d);
                });
            }
        }
        List<Map<String,Object>> bestSellers = quantities.entrySet().stream()
                .sorted(Map.Entry.<String,Long>comparingByValue(Comparator.reverseOrder()))
                .limit(10).map(e -> Map.<String,Object>of("name", e.getKey(), "quantity", e.getValue(), "sales", amounts.getOrDefault(e.getKey(), 0d))).toList();
        List<Map<String,Object>> reportOrders = orders.stream().map(o -> {
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("code", o.code == null ? "—" : o.code);
            row.put("client", o.clientName == null ? "—" : o.clientName);
            row.put("status", o.status == null ? "—" : o.status.name());
            row.put("total", o.total == null ? 0 : o.total);
            row.put("createdAt", o.createdAt == null ? Instant.EPOCH : o.createdAt);
            row.put("deliveredAt", o.deliveredAt);
            row.put("isSale", o.status == OrderStatus.ENTREGADO && o.deliveredAt != null && !o.deliveredAt.isBefore(start) && o.deliveredAt.isBefore(end));
            return row;
        }).toList();
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("pharmacyName", user.pharmacyName == null || user.pharmacyName.isBlank() ? user.name : user.pharmacyName);
        result.put("from", from.toString());
        result.put("to", to.toString());
        result.put("generatedAt", Instant.now());
        result.put("orders", orders.size());
        result.put("delivered", sales.size());
        result.put("sales", totalSales);
        result.put("bestSellers", bestSellers);
        result.put("reportOrders", reportOrders);
        return result;
    }

    private Map<String,Object> pharmacyPeriod(List<Order> orders, LocalDate from) {
        Instant start = from.atStartOfDay(ZONE).toInstant();
        Instant end = LocalDate.now(ZONE).plusDays(1).atStartOfDay(ZONE).toInstant();
        List<Order> created = orders.stream().filter(o -> o.createdAt != null && !o.createdAt.isBefore(start) && o.createdAt.isBefore(end)).toList();
        List<Order> deliveredOrders = orders.stream().filter(o -> o.status == OrderStatus.ENTREGADO && o.deliveredAt != null && !o.deliveredAt.isBefore(start) && o.deliveredAt.isBefore(end)).toList();
        double sales = deliveredOrders.stream().mapToDouble(o -> o.total == null ? 0 : o.total).sum();
        return Map.of("orders", created.size(), "delivered", deliveredOrders.size(), "sales", sales);
    }

    public Map<String,Object> courier(User user) {
        List<Order> orders = mongo.find(Query.query(Criteria.where("courierId").is(user.id)).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(1000), Order.class);
        Map<String, User> pharmacies = new HashMap<>();
        orders.stream().map(o -> o.pharmacyId).filter(id -> id != null && !id.isBlank()).distinct().forEach(id -> {
            User pharmacy = users.findById(id).orElse(null);
            if (pharmacy != null) pharmacies.put(id, pharmacy);
        });
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("today", courierPeriod(orders, pharmacies, LocalDate.now(ZONE)));
        result.put("week", courierPeriod(orders, pharmacies, LocalDate.now(ZONE).minusDays(6)));
        result.put("month", courierPeriod(orders, pharmacies, LocalDate.now(ZONE).withDayOfMonth(1)));
        Map<String,Long> zones = orders.stream().filter(o -> o.status == OrderStatus.ENTREGADO).collect(Collectors.groupingBy(o -> o.city != null && !o.city.isBlank() ? o.city : (o.zone == null || o.zone.isBlank() ? "Sin zona" : o.zone), Collectors.counting()));
        List<Map<String,Object>> commonZones = zones.entrySet().stream().sorted(Map.Entry.<String,Long>comparingByValue(Comparator.reverseOrder())).limit(5).map(e -> Map.<String,Object>of("zone",e.getKey(),"deliveries",e.getValue())).toList();
        result.put("commonZones", commonZones);
        result.put("recentOrders", orders.stream().limit(5).map(o -> Map.of("code", o.code == null ? "—" : o.code, "status", o.status == null ? "—" : o.status.name(), "zone", o.city != null && !o.city.isBlank() ? o.city : (o.zone == null ? "Sin zona" : o.zone), "createdAt", o.createdAt == null ? Instant.EPOCH : o.createdAt)).toList());
        long delivered = orders.stream().filter(o -> o.status == OrderStatus.ENTREGADO && o.deliveredAt != null).count();
        long priced = orders.stream().filter(o -> o.status == OrderStatus.ENTREGADO && o.deliveredAt != null && earningsFor(o, pharmacies) != null).count();
        result.put("earningsConfigured", delivered == 0 || priced > 0);
        result.put("deliveriesMissingCoordinates", Math.max(0, delivered - priced));
        result.put("feeFormula", "COP $2.000 base + $1.000 por kilómetro iniciado (mínimo $3.000); distancia vial estimada como distancia geodésica × 1,3.");
        return result;
    }

    /** Reporte del repartidor: entregas e ingresos del rango pedido, con acumulado por domicilio. */
    public Map<String,Object> courierReport(User user, String fromText, String toText) {
        LocalDate from;
        LocalDate to;
        try {
            from = LocalDate.parse(fromText);
            to = LocalDate.parse(toText);
        } catch (DateTimeParseException | NullPointerException ex) {
            throw new IllegalArgumentException("Debes indicar una fecha inicial y final válidas.");
        }
        if (to.isBefore(from)) throw new IllegalArgumentException("La fecha final no puede ser anterior a la inicial.");
        if (java.time.temporal.ChronoUnit.DAYS.between(from, to) > 366) throw new IllegalArgumentException("El rango máximo permitido es de 367 días.");
        Instant start = from.atStartOfDay(ZONE).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(ZONE).toInstant();

        List<Order> orders = mongo.find(Query.query(Criteria.where("courierId").is(user.id)).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(5000), Order.class);
        Map<String, User> pharmacies = new HashMap<>();
        orders.stream().map(o -> o.pharmacyId).filter(id -> id != null && !id.isBlank()).distinct().forEach(id -> {
            User pharmacy = users.findById(id).orElse(null);
            if (pharmacy != null) pharmacies.put(id, pharmacy);
        });

        LocalDate today = LocalDate.now(ZONE);
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("today", courierPeriod(orders, pharmacies, today));
        result.put("week", courierPeriod(orders, pharmacies, today.minusDays(6)));
        result.put("month", courierPeriod(orders, pharmacies, today.withDayOfMonth(1)));

        List<Order> delivered = orders.stream()
                .filter(o -> o.status == OrderStatus.ENTREGADO && o.deliveredAt != null && !o.deliveredAt.isBefore(start) && o.deliveredAt.isBefore(end))
                .sorted(Comparator.comparing((Order o) -> o.deliveredAt))
                .toList();

        double running = 0;
        long missing = 0;
        Map<String, long[]> zoneCount = new LinkedHashMap<>();
        Map<String, Double> zoneMoney = new HashMap<>();
        List<Map<String,Object>> rows = new ArrayList<>();
        for (Order o : delivered) {
            Double fee = earningsFor(o, pharmacies);
            if (fee == null) missing++; else running += fee;
            String zone = o.city != null && !o.city.isBlank() ? o.city : (o.zone == null || o.zone.isBlank() ? "Sin zona" : o.zone);
            zoneCount.computeIfAbsent(zone, k -> new long[1])[0]++;
            if (fee != null) zoneMoney.merge(zone, fee, Double::sum);
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("code", o.code == null ? "—" : o.code);
            row.put("deliveredAt", o.deliveredAt);
            row.put("zone", zone);
            row.put("pharmacyName", o.pharmacyName == null ? "—" : o.pharmacyName);
            row.put("earnings", fee);
            row.put("accumulated", running);
            rows.add(row);
        }
        List<Map<String,Object>> topZones = zoneCount.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue()[0], a.getValue()[0]))
                .limit(8)
                .map(e -> Map.<String,Object>of("zone", e.getKey(), "deliveries", e.getValue()[0], "earnings", zoneMoney.getOrDefault(e.getKey(), 0d)))
                .toList();

        result.put("from", from.toString());
        result.put("to", to.toString());
        result.put("deliveries", delivered.size());
        result.put("earnings", running);
        result.put("avgPerDelivery", delivered.size() - missing > 0 ? running / (delivered.size() - missing) : 0d);
        result.put("topZones", topZones);
        result.put("rows", rows);
        result.put("deliveriesMissingCoordinates", missing);
        result.put("feeFormula", "COP $2.000 base + $1.000 por kilómetro iniciado (mínimo $3.000); distancia vial estimada como distancia geodésica × 1,3.");
        return result;
    }

    private Map<String,Object> courierPeriod(List<Order> orders, Map<String,User> pharmacies, LocalDate from) {
        Instant start = from.atStartOfDay(ZONE).toInstant();
        Instant end = LocalDate.now(ZONE).plusDays(1).atStartOfDay(ZONE).toInstant();
        List<Order> period = orders.stream().filter(o -> o.status == OrderStatus.ENTREGADO && o.deliveredAt != null && !o.deliveredAt.isBefore(start) && o.deliveredAt.isBefore(end)).toList();
        double earnings = period.stream().map(o -> earningsFor(o, pharmacies)).filter(v -> v != null).mapToDouble(Double::doubleValue).sum();
        long missing = period.stream().filter(o -> earningsFor(o, pharmacies) == null).count();
        return Map.of("deliveries", period.size(), "earnings", earnings, "deliveriesMissingCoordinates", missing);
    }

    private Double earningsFor(Order order, Map<String,User> pharmacies) {
        if (order.courierEarnings != null) return order.courierEarnings;
        User pharmacy = pharmacies.get(order.pharmacyId);
        if (pharmacy == null || pharmacy.latitude == null || pharmacy.longitude == null || order.latitude == null || order.longitude == null) return null;
        double km = estimatedRoadDistanceKm(pharmacy.latitude, pharmacy.longitude, order.latitude, order.longitude);
        return Math.max(3000, 2000 + Math.ceil(km) * 1000);
    }

    private static double estimatedRoadDistanceKm(double fromLat, double fromLon, double toLat, double toLon) {
        double earthKm = 6371.0088;
        double lat1 = Math.toRadians(fromLat), lat2 = Math.toRadians(toLat);
        double dLat = lat2 - lat1, dLon = Math.toRadians(toLon - fromLon);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return Math.round(2 * earthKm * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) * 1.3 * 10.0) / 10.0;
    }
}
