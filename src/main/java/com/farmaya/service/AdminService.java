package com.farmaya.service;

import static org.springframework.data.mongodb.core.query.Criteria.where;

import com.farmaya.model.Order;
import com.farmaya.model.OrderStatus;
import com.farmaya.model.Role;
import com.farmaya.model.User;
import com.farmaya.repo.UserRepository;
import com.farmaya.web.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Service
public class AdminService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final MovementService movements;
    private final EmailService emailService;
    private final org.springframework.security.crypto.password.PasswordEncoder encoder = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();

    public AdminService(MongoTemplate mongo, UserRepository users, MovementService movements, EmailService emailService) {
        this.mongo = mongo;
        this.users = users;
        this.movements = movements;
        this.emailService = emailService;
    }

    public User createAdmin(com.farmaya.model.Dtos.CreateAdminRequest req, User currentAdmin) {
        String name = req.name() == null ? "" : req.name().trim();
        String email = req.email() == null ? "" : req.email().trim().toLowerCase();
        String phone = req.phone() == null ? "" : req.phone().trim();
        String password = req.password() == null ? "" : req.password();

        if (name.length() < 2) throw ApiException.bad("Escribe el nombre completo del administrador.");
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw ApiException.bad("Escribe un correo electrónico válido.");
        if (password.length() < 8) throw ApiException.bad("La contraseña debe tener al menos 8 caracteres.");
        if (phone.replaceAll("\\D", "").length() < 7) throw ApiException.bad("Escribe un teléfono de contacto válido.");

        if (users.findByEmailIgnoreCase(email).isPresent()) {
            throw ApiException.conflict("Ya existe una cuenta con ese correo.");
        }

        User a = new User();
        a.name = name;
        a.email = email;
        a.phone = phone;
        a.role = Role.ADMIN;
        a.passwordHash = encoder.encode(password);
        a.enabled = true;
        a.verified = true;
        a.active = true;
        a.createdAt = java.time.Instant.now();

        User saved = users.save(a);
        emailService.sendAccountCreatedAsync(saved);
        movements.record("USUARIO_CREACION_ADMIN", "Creó una nueva cuenta de administrador para " + saved.name + " (" + saved.email + ")", currentAdmin, null);
        return saved;
    }

    public List<User> users(String role) {
        if (role != null && !role.isBlank()) {
            try {
                return users.findByRole(Role.valueOf(role)).stream()
                        .sorted(java.util.Comparator.comparing((User u) -> u.createdAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())).reversed())
                        .limit(500).toList();
            } catch (IllegalArgumentException e) {
                throw ApiException.bad("Rol no válido.");
            }
        }
        return users.findAll().stream().limit(500).toList();
    }

    public List<User> pendingVerifications() {
        return users.findPendingVerifications();
    }

    public User setVerified(String id, boolean value, User admin) {
        User u = find(id);
        Update up = new Update().set("verified", value);
        if (value) {
            up.set("enabled", true).set("active", true);
        }
        User changed = update(id, up);
        movements.record("USUARIO_VERIFICACION", (value ? "Verificó " : "Retiró verificación a ") + displayName(changed), admin, null);
        if (value && changed.email != null && !changed.email.isBlank()) {
            emailService.sendAccountVerifiedAsync(changed);
            movements.record("NOTIFICACION_CORREO", "Notificacion oficial de aprobacion y activacion de cuenta enviada a " + changed.email, admin, null);
        } else if (!value && changed.email != null && !changed.email.isBlank()) {
            emailService.sendAccountVerificationNeededAsync(changed);
            movements.record("NOTIFICACION_CORREO", "Notificacion de verificacion requerida enviada a " + changed.email, admin, null);
        }
        return changed;
    }

    public User setEnabled(String id, boolean value, User admin) {
        return setEnabled(id, value, null, admin);
    }

    public User setEnabled(String id, boolean value, String reason, User admin) {
        User u = find(id);
        if (u.id.equals(admin.id)) throw ApiException.bad("No puedes deshabilitar tu propia cuenta.");
        Update up = new Update().set("enabled", value);
        if (value) {
            up.set("active", true).unset("disabledReason").unset("disabledAt");
        } else {
            up.set("active", false);
            if (reason != null && !reason.isBlank()) {
                up.set("disabledReason", reason.trim());
            }
            up.set("disabledAt", java.time.Instant.now());
        }
        User changed = update(id, up);
        String actionDesc = (value ? "Habilitó " : "Deshabilitó ") + displayName(changed)
                + (!value && reason != null && !reason.isBlank() ? " | Motivo: " + reason.trim() : "");
        movements.record("USUARIO_ESTADO", actionDesc, admin, null);

        if (!value && changed.email != null && !changed.email.isBlank()) {
            emailService.sendAccountDisabledAsync(changed, reason);
            movements.record("NOTIFICACION_CORREO", "Notificación de deshabilitación enviada a " + changed.email + (reason != null && !reason.isBlank() ? " con motivo: " + reason.trim() : ""), admin, null);
        } else if (value && changed.email != null && !changed.email.isBlank()) {
            emailService.sendAccountEnabledAsync(changed);
            movements.record("NOTIFICACION_CORREO", "Notificación de reactivación y habilitación enviada a " + changed.email, admin, null);
        }
        return changed;
    }

    public User setActive(String id, boolean value, User admin) {
        User u = find(id);
        if (value && !u.enabled) {
            throw ApiException.bad("No se puede poner activa una cuenta que está deshabilitada. Habilítela primero.");
        }
        Update up = new Update().set("active", value);
        User changed = update(id, up);
        movements.record("USUARIO_PAUSA", (value ? "Reanudó actividad de " : "Puso en pausa actividad de ") + displayName(changed), admin, null);
        return changed;
    }

    public User setEditPermission(String id, boolean value, User admin) {
        User u = find(id);
        if (u.role != Role.FARMACIA) throw ApiException.bad("El permiso de edición solo aplica a farmacias.");
        Update up = new Update().set("canEditProfile", value);
        if (!value) {
            up.set("editPermissionRequested", false);
        }
        User changed = update(id, up);
        movements.record("USUARIO_PERMISO_EDICION", (value ? "Autorizó a la farmacia " : "Revocó permiso de edición a ") + displayName(changed), admin, null);
        return changed;
    }

    public List<com.farmaya.model.Movement> movements() { return movements.latestForAdmin(); }

    public Map<String, Object> stats() {
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (OrderStatus s : OrderStatus.values()) byStatus.put(s.name(), 0L);
        var byStatusAgg = Aggregation.newAggregation(Aggregation.group("status").count().as("n"));
        for (Document d : mongo.aggregate(byStatusAgg, Order.class, Document.class)) {
            byStatus.put(String.valueOf(d.get("_id")), ((Number) d.get("n")).longValue());
        }

        double revenue = 0;
        var revenueAgg = Aggregation.newAggregation(
                Aggregation.match(where("status").is(OrderStatus.ENTREGADO)),
                Aggregation.group().sum("total").as("sum"));
        for (Document d : mongo.aggregate(revenueAgg, Order.class, Document.class)) {
            Object v = d.get("sum");
            if (v instanceof Number n) revenue = n.doubleValue();
        }

        double platformEarnings = Math.round(revenue * 0.05 * 100) / 100.0;

        List<OrderStatus> paidStatuses = List.of(
            OrderStatus.PRECIO_CONFIRMADO, OrderStatus.PEDIDO_EN_PREPARACION,
            OrderStatus.PEDIDO_LISTO, OrderStatus.BUSCANDO_REPARTIDOR,
            OrderStatus.REPARTIDOR_ASIGNADO, OrderStatus.PEDIDO_RECOGIDO,
            OrderStatus.EN_CAMINO, OrderStatus.ENTREGADO
        );
        double gmv = 0;
        var gmvAgg = Aggregation.newAggregation(
                Aggregation.match(where("status").in(paidStatuses)),
                Aggregation.group().sum("total").as("sum"));
        for (Document d : mongo.aggregate(gmvAgg, Order.class, Document.class)) {
            Object v = d.get("sum");
            if (v instanceof Number n) gmv = n.doubleValue();
        }
        double grossPlatformEarnings = Math.round(gmv * 0.05 * 100) / 100.0;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("byStatus", byStatus);
        m.put("pharmacies", Map.of("verified", count(Role.FARMACIA, true), "pending", count(Role.FARMACIA, false)));
        m.put("couriers", Map.of("verified", count(Role.REPARTIDOR, true), "pending", count(Role.REPARTIDOR, false)));
        m.put("clients", count(Role.CLIENTE, true));
        m.put("revenue", revenue);
        m.put("platformEarnings", platformEarnings);
        m.put("gmv", gmv);
        m.put("grossPlatformEarnings", grossPlatformEarnings);
        m.put("commissionRate", 0.05);
        return m;
    }

    private String displayName(User u) { return u.role == Role.FARMACIA && u.pharmacyName != null ? u.pharmacyName : u.name; }

    private long count(Role role, boolean verified) {
        return users.findByRole(role).stream()
                .filter(u -> role == Role.CLIENTE || u.verified == verified)
                .count();
    }

    private User find(String id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("Usuario no encontrado."));
    }

    private User update(String id, Update update) {
        User user = find(id);
        org.springframework.data.mongodb.core.query.Query q = new org.springframework.data.mongodb.core.query.Query(
                com.farmaya.repo.UserRepository.idCriteria(id));
        for (String col : com.farmaya.repo.UserRepository.COLLECTIONS) {
            mongo.updateMulti(q, update, col);
        }
        if (user.email != null && !user.email.isBlank()) {
            org.springframework.data.mongodb.core.query.Query qEmail = new org.springframework.data.mongodb.core.query.Query(
                    org.springframework.data.mongodb.core.query.Criteria.where("email").regex("^" + java.util.regex.Pattern.quote(user.email.trim()) + "$", "i"));
            for (String col : com.farmaya.repo.UserRepository.COLLECTIONS) {
                mongo.updateMulti(qEmail, update, col);
            }
        }
        org.bson.Document changes = update.getUpdateObject();
        Object set = changes.get("$set");
        if (set instanceof org.bson.Document fields) {
            fields.forEach((key, value) -> {
                switch (key) {
                    case "verified" -> user.verified = Boolean.TRUE.equals(value);
                    case "enabled" -> {
                        user.enabled = Boolean.TRUE.equals(value);
                        if (user.enabled) user.active = true;
                        else user.active = false;
                    }
                    case "active" -> user.active = Boolean.TRUE.equals(value);
                    case "canEditProfile" -> user.canEditProfile = Boolean.TRUE.equals(value);
                    case "editPermissionRequested" -> user.editPermissionRequested = Boolean.TRUE.equals(value);
                    default -> { }
                }
            });
        }
        return users.save(user);
    }
}
