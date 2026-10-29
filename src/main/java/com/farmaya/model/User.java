package com.farmaya.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import org.springframework.data.annotation.Id;

public class User {
    @Id public String id;
    public String name;
    public String email;
    @JsonIgnore public String passwordHash;
    public String phone;
    public Role role;
    public String zone;
    public String city;

    /** El administrador puede deshabilitar cuentas. */
    public boolean enabled = true;
    /** Farmacias y repartidores deben ser verificados por un administrador. */
    public boolean verified;
    /** Farmacia: recibiendo pedidos. Repartidor: disponible. */
    public boolean active = true;

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

    public Instant createdAt = Instant.now();
}
