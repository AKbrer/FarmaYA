package com.farmaya.model;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/** Sesión de usuario. Solo se guarda el hash del token. Mongo elimina las vencidas (TTL). */
@Document("sessions")
public class Session {
    @Id public String tokenHash;
    public String userId;
    @Indexed(expireAfterSeconds = 0) public Instant expiresAt;

    public static String hash(String token) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
