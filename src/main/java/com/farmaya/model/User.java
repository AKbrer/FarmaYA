package com.farmaya.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;

public class User {
    @Id public String id;
    public String name;
    @Indexed public String email;
    @JsonIgnore public String passwordHash;
    public String phone;
    @Indexed public Role role;
    public String zone;
    public String city;

    /** El administrador puede deshabilitar cuentas. */
    public boolean enabled = true;
    /** Motivo y fecha cuando un administrador deshabilita la cuenta. */
    public String disabledReason;
    public Instant disabledAt;
    /** Farmacias y repartidores deben ser verificados por un administrador. */
    @Indexed public boolean verified;
    /** Farmacia: recibiendo pedidos. Repartidor: disponible. */
    public boolean active = true;
    /** Validación de correo mediante código OTP. */
    public boolean emailVerified = true;

    // Datos Bancarios para Desembolsos / Liquidación de Ventas (Farmacia y Repartidor)
    public String bankName;
    public String accountType;
    public String accountNumber;
    public String accountHolder;
    public String accountDocNumber;

    // Farmacia
    public String pharmacyName;
    public String address;
    /** Coordenadas del establecimiento para estimar distancia de entrega. */
    public Double latitude, longitude;
    public String licenseNumber;
    public String openFrom;
    public String openTo;
    /** Las farmacias requieren permiso del administrador para modificar sus datos o teléfono */
    public boolean canEditProfile;
    public boolean editPermissionRequested;
    public String editRequestNote;
    public Instant editRequestedAt;

    // Repartidor
    public String vehicle;
    public String plate;

    // Expediente de Verificación (PDFs subidos al registrarse o postularse)
    public java.util.List<VerificationDoc> verificationDocuments = new java.util.ArrayList<>();

    public static class VerificationDoc {
        public String docType;
        public String title;
        public String filename;
        public String dataUrl;
        public Instant uploadedAt = Instant.now();

        public VerificationDoc() {}
        public VerificationDoc(String docType, String title, String filename, String dataUrl) {
            this.docType = docType;
            this.title = title;
            this.filename = filename;
            this.dataUrl = dataUrl;
        }
    }

    // Autenticación con Google
    public String googleId;
    public String avatarUrl;

    @Indexed public Instant createdAt = Instant.now();
}
