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

    // Autenticación con Google
    public String googleId;
    public String avatarUrl;

    public Instant createdAt = Instant.now();
}
