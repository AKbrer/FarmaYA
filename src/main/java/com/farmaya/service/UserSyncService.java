package com.farmaya.service;

import com.farmaya.model.Role;
import com.farmaya.model.User;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

/**
 * Sincroniza automáticamente cada usuario con la colección
 * correspondiente a su rol (clientes, farmacias, domiciliarios,
 * administradores) cada vez que se crea o actualiza.
 *
 * Usa upsert con el mismo _id, por lo que es idempotente.
 */
@Service
public class UserSyncService {
    private static final Logger log = LoggerFactory.getLogger(UserSyncService.class);
    private final MongoTemplate mongo;

    public UserSyncService(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    /** Guarda o actualiza el documento del usuario en su colección por rol. */
    public void sync(User user) {
        if (user == null || user.id == null || user.role == null) return;

        String collection = collectionForRole(user.role);
        if (collection == null) return;

        try {
            Document doc = new Document();
            doc.put("_id", user.id);
            doc.put("name", user.name);
            doc.put("email", user.email);
            doc.put("passwordHash", user.passwordHash);
            doc.put("phone", user.phone);
            doc.put("role", user.role.name());
            doc.put("zone", user.zone);
            doc.put("enabled", user.enabled);
            doc.put("verified", user.verified);
            doc.put("active", user.active);
            doc.put("city", user.city);
            doc.put("createdAt", user.createdAt);

            // Campos de farmacia
            if (user.role == Role.FARMACIA) {
                doc.put("pharmacyName", user.pharmacyName);
                doc.put("address", user.address);
                doc.put("latitude", user.latitude);
                doc.put("longitude", user.longitude);
                doc.put("licenseNumber", user.licenseNumber);
                doc.put("openFrom", user.openFrom);
                doc.put("openTo", user.openTo);
                doc.put("canEditProfile", user.canEditProfile);
                doc.put("editPermissionRequested", user.editPermissionRequested);
                doc.put("editRequestNote", user.editRequestNote);
                doc.put("editRequestedAt", user.editRequestedAt);
            }

            // Campos de repartidor
            if (user.role == Role.REPARTIDOR) {
                doc.put("vehicle", user.vehicle);
                doc.put("plate", user.plate);
            }

            if (user.verificationDocuments != null && !user.verificationDocuments.isEmpty()) {
                doc.put("verificationDocuments", user.verificationDocuments);
            }

            // Upsert: inserta si no existe, actualiza si ya existe (mismo _id)
            Document filter = new Document("_id", user.id);
            Document update = new Document("$set", doc);
            mongo.getCollection(collection).updateOne(filter, update, new com.mongodb.client.model.UpdateOptions().upsert(true));

            log.debug("Usuario {} sincronizado a colección '{}'.", user.id, collection);
        } catch (Exception e) {
            log.error("Error sincronizando usuario {} a colección '{}': {}", user.id, collectionForRole(user.role), e.getMessage());
        }
    }

    /** Determina la colección destino según el rol. */
    private String collectionForRole(Role role) {
        return switch (role) {
            case CLIENTE -> "clientes";
            case FARMACIA -> "farmacias";
            case REPARTIDOR -> "domiciliarios";
            case ADMIN -> "administradores";
        };
    }
}
