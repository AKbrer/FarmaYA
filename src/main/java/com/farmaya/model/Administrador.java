package com.farmaya.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/** Cuenta administrativa almacenada en su propia colección. */
@Document("administradores")
public class Administrador {
    @Id public String id;
    public String name;
    @Indexed(unique = true) public String email;
    @JsonIgnore public String passwordHash;
    public String phone;
    public String zone;
    public boolean enabled = true;
    public boolean verified = true;
    public Instant createdAt = Instant.now();
}
