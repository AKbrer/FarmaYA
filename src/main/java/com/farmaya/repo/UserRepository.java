package com.farmaya.repo;

import com.farmaya.model.Role;
import com.farmaya.model.User;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

/**
 * Acceso unificado a cuentas sin utilizar la colección histórica `users`.
 * Cada cuenta se persiste exclusivamente en la colección correspondiente a su rol.
 */
@Repository
public class UserRepository {
    public static final List<String> COLLECTIONS = List.of(
            "clientes", "farmacias", "domiciliarios", "administradores", "users");

    private final MongoTemplate mongo;

    public UserRepository(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public static Criteria idCriteria(String id) {
        if (id == null || id.isBlank()) return Criteria.where("_id").is(id);
        if (org.bson.types.ObjectId.isValid(id)) {
            org.bson.types.ObjectId objId = new org.bson.types.ObjectId(id);
            return new Criteria().orOperator(
                    Criteria.where("_id").is(id),
                    Criteria.where("_id").is(objId)
            );
        }
        return Criteria.where("_id").is(id);
    }

    public User save(User user) {
        if (user == null || user.role == null) {
            throw new IllegalArgumentException("La cuenta debe tener un rol antes de guardarse.");
        }
        String col = collectionFor(user.role);
        if (user.id != null && !user.id.isBlank()) {
            Query q = new Query(idCriteria(user.id));
            org.springframework.data.mongodb.core.query.Update update = new org.springframework.data.mongodb.core.query.Update()
                    .set("enabled", user.enabled)
                    .set("verified", user.verified)
                    .set("active", user.active)
                    .set("name", user.name)
                    .set("phone", user.phone)
                    .set("address", user.address)
                    .set("city", user.city)
                    .set("zone", user.zone)
                    .set("pharmacyName", user.pharmacyName)
                    .set("licenseNumber", user.licenseNumber)
                    .set("openFrom", user.openFrom)
                    .set("openTo", user.openTo)
                    .set("canEditProfile", user.canEditProfile)
                    .set("editPermissionRequested", user.editPermissionRequested)
                    .set("editRequestNote", user.editRequestNote)
                    .set("vehicle", user.vehicle)
                    .set("plate", user.plate);
            if (user.latitude != null) update.set("latitude", user.latitude);
            if (user.longitude != null) update.set("longitude", user.longitude);
            if (user.verificationDocuments != null) update.set("verificationDocuments", user.verificationDocuments);
            for (String c : COLLECTIONS) {
                mongo.updateMulti(q, update, c);
            }
        }
        return mongo.save(user, col);
    }

    public Optional<User> findById(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        Query q = new Query(idCriteria(id)).limit(1);
        for (String collection : COLLECTIONS) {
            User user = mongo.findOne(q, User.class, collection);
            if (user != null) return Optional.of(user);
        }
        return Optional.empty();
    }

    public Optional<User> findByEmailIgnoreCase(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        Query query = new Query(new Criteria().andOperator(
                Criteria.where("role").exists(true),
                Criteria.where("email").regex("^" + Pattern.quote(email.trim()) + "$", "i"))).limit(1);
        for (String collection : COLLECTIONS) {
            User user = mongo.findOne(query, User.class, collection);
            if (user != null) return Optional.of(user);
        }
        return Optional.empty();
    }

    public List<User> findByRole(Role role) {
        if (role == null) return List.of();
        Map<String, User> byId = new LinkedHashMap<>();
        for (User u : mongo.find(new Query(Criteria.where("role").is(role)), User.class, collectionFor(role))) {
            if (u.id != null) byId.put(u.id, u);
        }
        for (User u : mongo.find(new Query(Criteria.where("role").is(role)), User.class, "users")) {
            if (u.id != null) byId.putIfAbsent(u.id, u);
        }
        return new ArrayList<>(byId.values());
    }

    public boolean existsByRole(Role role) {
        return !findByRole(role).isEmpty();
    }

    public List<User> findAll() {
        Map<String, User> allById = new LinkedHashMap<>();
        for (String collection : COLLECTIONS) {
            for (User u : mongo.find(new Query(Criteria.where("role").exists(true)), User.class, collection)) {
                if (u.id != null) allById.putIfAbsent(u.id, u);
            }
        }
        List<User> all = new ArrayList<>(allById.values());
        all.sort(Comparator.comparing((User u) -> u.createdAt,
                Comparator.nullsLast(Comparator.naturalOrder())).reversed());
        return all;
    }

    public static String collectionFor(Role role) {
        return switch (role) {
            case CLIENTE -> "clientes";
            case FARMACIA -> "farmacias";
            case REPARTIDOR -> "domiciliarios";
            case ADMIN -> "administradores";
        };
    }
}
