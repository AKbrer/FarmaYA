package com.farmaya.model;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/** Auditoría de acciones y cambios importantes de FarmaYa. */
@Document("movimientos")
public class Movement {
    @Id public String id;
    @Indexed(unique = true) public String code;
    public String type;
    public String description;
    public String orderId;
    public String orderCode;
    public String actorId;
    public String actorName;
    public String actorRole;
    public Instant createdAt = Instant.now();
}
