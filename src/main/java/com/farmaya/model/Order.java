package com.farmaya.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("pedidos")
public class Order {
    @Id public String id;
    @Indexed(unique = true) public String code;

    // Cliente y entrega
    public String clientId, clientName, clientPhone, address, zone, city, notes;
    public Double latitude, longitude;
    public List<Item> items = new ArrayList<>();
    public OrderStatus status;

    // Farmacia
    public String pharmacyId, pharmacyName, pharmacyAddress, pharmacyZone;
    public Double pharmacyLatitude, pharmacyLongitude;
    /** Distancia vial estimada y tarifa congelada al completar la entrega. */
    public Double deliveryDistanceKm, courierEarnings;
    public List<ConfirmedItem> confirmedItems = new ArrayList<>();
    public Double total;
    public Integer prepMinutes;
    public String pharmacyNote;

    // Repartidor
    public String courierId, courierName, courierPhone;

    // Ganancia y comisión empresarial FarmaYA (empresa dueña del programa)
    public Double platformCommissionRate = 0.10; // 10%
    public Double platformEarnings; // Ganancia retenida por pedido

    // Verificación de entrega
    public String deliveryCode;
    public int codeAttempts;

    // Control de búsqueda (no se exponen)
    @JsonIgnore public Set<String> rejectedPharmacies = new HashSet<>();
    @JsonIgnore public Set<String> rejectedCouriers = new HashSet<>();
    public int searchRound = 1;
    public int courierRound = 1;
    public Instant searchStartedAt, assignedAt, priceAskedAt, courierSearchStartedAt, deliveredAt;

    // Incidencias
    public OrderStatus statusBeforeIncident;
    public String incidentNote, incidentBy;

    public List<HistoryEntry> history = new ArrayList<>();
    public Instant createdAt, updatedAt;

    /** Solo para la respuesta al repartidor (no se persiste). */
    @Transient public Integer itemCount;

    public static class Item {
        public String name;
        public int quantity;
        public boolean prescription;
        public String note;

        public Item() {}

        public Item(String name, int quantity, boolean prescription, String note) {
            this.name = name;
            this.quantity = quantity;
            this.prescription = prescription;
            this.note = note;
        }
    }

    public static class ConfirmedItem {
        public String name;
        public int quantity;
        public double unitPrice;
        public boolean available;

        public ConfirmedItem() {}

        public ConfirmedItem(String name, int quantity, double unitPrice, boolean available) {
            this.name = name;
            this.quantity = quantity;
            this.unitPrice = unitPrice;
            this.available = available;
        }
    }

    /** Registro de quién hizo qué y cuándo. */
    public static class HistoryEntry {
        public OrderStatus status;
        public String actorId, actorName, actorRole, note;
        public Instant at = Instant.now();

        public HistoryEntry() {}

        public HistoryEntry(OrderStatus status, User actor, String note) {
            this.status = status;
            this.note = note;
            if (actor == null) {
                this.actorName = "FarmaYa";
                this.actorRole = "SISTEMA";
            } else {
                this.actorId = actor.id;
                this.actorName = actor.role == Role.FARMACIA && actor.pharmacyName != null ? actor.pharmacyName : actor.name;
                this.actorRole = actor.role.name();
            }
        }
    }
}
