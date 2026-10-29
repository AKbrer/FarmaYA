package com.farmaya.service;

import com.farmaya.model.Movement;
import com.farmaya.model.Order;
import com.farmaya.model.Order.HistoryEntry;
import com.farmaya.model.User;
import com.farmaya.repo.MovementRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

@Service
public class MovementService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneId.of("America/Bogota"));
    private final MovementRepository repository;

    public MovementService(MovementRepository repository) { this.repository = repository; }

    public void record(String type, String description, User actor, Order order) {
        Movement m = new Movement();
        m.type = type;
        m.description = description;
        if (order != null) { m.orderId = order.id; m.orderCode = order.code; }
        if (actor != null) { m.actorId = actor.id; m.actorName = actor.role == com.farmaya.model.Role.FARMACIA && actor.pharmacyName != null ? actor.pharmacyName : actor.name; m.actorRole = actor.role.name(); }
        else { m.actorName = "FarmaYa"; m.actorRole = "SISTEMA"; }
        m.createdAt = Instant.now();
        for (int i = 0; i < 5; i++) {
            m.code = "MOV-" + DAY.format(m.createdAt) + "-" + String.format("%05d", RANDOM.nextInt(100000));
            try { repository.save(m); return; }
            catch (DuplicateKeyException duplicate) { /* reintentar código */ }
        }
        throw new IllegalStateException("No se pudo generar un código único para el movimiento.");
    }

    public void recordOrderEvent(Order order, HistoryEntry event) {
        Movement m = new Movement();
        m.type = event.status == null ? "PEDIDO" : event.status.name();
        m.description = event.note == null || event.note.isBlank() ? "Actualización del pedido" : event.note;
        m.orderId = order.id; m.orderCode = order.code;
        m.actorId = event.actorId; m.actorName = event.actorName; m.actorRole = event.actorRole;
        m.createdAt = event.at == null ? Instant.now() : event.at;
        for (int i = 0; i < 5; i++) {
            m.code = "MOV-" + DAY.format(m.createdAt) + "-" + String.format("%05d", RANDOM.nextInt(100000));
            try { repository.save(m); return; }
            catch (DuplicateKeyException duplicate) { /* reintentar código */ }
        }
        throw new IllegalStateException("No se pudo generar un código único para el movimiento.");
    }

    public List<Movement> latest() { return repository.findTop500ByOrderByCreatedAtDesc(); }

    /** Movimientos exclusivos de administradores (auditoría administrativa, excluye pedidos operativos). */
    public List<Movement> latestForAdmin() {
        return repository.findTop500ByOrderByCreatedAtDesc().stream()
                .filter(m -> "ADMIN".equalsIgnoreCase(m.actorRole)
                          || (m.type != null && (m.type.startsWith("USUARIO_") || m.type.startsWith("ADMIN_")
                          || m.type.contains("VERIFICACION") || m.type.contains("EDICION") || m.type.contains("PERMISO"))))
                .toList();
    }

    public List<Movement> forActor(User actor) {
        if (actor == null || actor.id == null) return List.of();
        return repository.findTop500ByActorIdOrderByCreatedAtDesc(actor.id);
    }
}
