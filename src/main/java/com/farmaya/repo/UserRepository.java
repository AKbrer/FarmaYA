package com.farmaya.repo;

import com.farmaya.model.Role;
import com.farmaya.model.User;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

/**
 * Acceso unificado y de alto rendimiento a cuentas por rol en MongoDB.
 * Incluye enrutamiento directo y cache en memoria de colecciones para eliminar roundtrips innecesarios.
 */
@Repository
public class UserRepository {
    public static final List<String> COLLECTIONS = List.of(
            "clientes", "farmacias", "domiciliarios", "administradores", "users");

    // Cache en memoria para resolver al instante la coleccion donde reside cada usuario
    private static final Map<String, String> USER_COLLECTION_CACHE = new ConcurrentHashMap<>();
    private static final Map<String, String> EMAIL_COLLECTION_CACHE = new ConcurrentHashMap<>();

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

    public static void evictCache(String id, String email) {
        if (id != null) USER_COLLECTION_CACHE.remove(id);
        if (email != null) EMAIL_COLLECTION_CACHE.remove(email.trim().toLowerCase());
    }

    public User save(User user) {
        if (user == null || user.role == null) {
            throw new IllegalArgumentException("La cuenta debe tener un rol antes de guardarse.");
        }
        String col = collectionFor(user.role);
        if (user.id != null && !user.id.isBlank()) {
            USER_COLLECTION_CACHE.put(user.id, col);
            if (user.email != null) EMAIL_COLLECTION_CACHE.put(user.email.trim().toLowerCase(), col);

            Query q = new Query(idCriteria(user.id));
            org.springframework.data.mongodb.core.query.Update update = new org.springframework.data.mongodb.core.query.Update()
                    .set("enabled", user.enabled)
                    .set("verified", user.verified)
                    .set("active", user.active)
                    .set("name", user.name)
                    .set("phone", user.phone)
                    .set("address", user.address)
                    .set("city", user.city)
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
            if (user.email != null && !user.email.isBlank()) {
                Query qEmail = new Query(Criteria.where("email").regex("^" + Pattern.quote(user.email.trim()) + "$", "i"));
                for (String c : COLLECTIONS) {
                    mongo.updateMulti(qEmail, update, c);
                }
            }
        }
        User saved = mongo.save(user, col);
        if (saved != null && saved.id != null) {
            USER_COLLECTION_CACHE.put(saved.id, col);
            if (saved.email != null) EMAIL_COLLECTION_CACHE.put(saved.email.trim().toLowerCase(), col);
        }
        return saved;
    }

    public Optional<User> findById(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        Query q = new Query(idCriteria(id)).limit(1);

        // 1. Intento rapido en la coleccion recordada (1 solo salto de red a Atlas en lugar de 5)
        String cachedCol = USER_COLLECTION_CACHE.get(id);
        if (cachedCol != null) {
            User user = mongo.findOne(q, User.class, cachedCol);
            if (user != null) return Optional.of(user);
            USER_COLLECTION_CACHE.remove(id);
        }

        // 2. Busqueda exhaustiva y registro en cache
        for (String collection : COLLECTIONS) {
            User user = mongo.findOne(q, User.class, collection);
            if (user != null) {
                USER_COLLECTION_CACHE.put(id, collection);
                if (user.email != null) EMAIL_COLLECTION_CACHE.put(user.email.trim().toLowerCase(), collection);
                return Optional.of(user);
            }
        }
        return Optional.empty();
    }

    public Optional<User> findByEmailIgnoreCase(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        String cleanEmail = email.trim().toLowerCase();
        Query query = new Query(new Criteria().andOperator(
                Criteria.where("role").exists(true),
                Criteria.where("email").regex("^" + Pattern.quote(email.trim()) + "$", "i"))).limit(1);

        // 1. Intento rapido en la coleccion recordada
        String cachedCol = EMAIL_COLLECTION_CACHE.get(cleanEmail);
        if (cachedCol != null) {
            User user = mongo.findOne(query, User.class, cachedCol);
            if (user != null) {
                if (user.id != null) USER_COLLECTION_CACHE.put(user.id, cachedCol);
                return Optional.of(user);
            }
            EMAIL_COLLECTION_CACHE.remove(cleanEmail);
        }

        // 2. Busqueda exhaustiva en todas las colecciones
        for (String collection : COLLECTIONS) {
            User user = mongo.findOne(query, User.class, collection);
            if (user != null) {
                EMAIL_COLLECTION_CACHE.put(cleanEmail, collection);
                if (user.id != null) USER_COLLECTION_CACHE.put(user.id, collection);
                return Optional.of(user);
            }
        }
        return Optional.empty();
    }

    public List<User> findByRole(Role role) {
        if (role == null) return List.of();
        Map<String, User> byId = new LinkedHashMap<>();
        for (User u : mongo.find(new Query(Criteria.where("role").is(role)), User.class, collectionFor(role))) {
            if (u.id != null) {
                byId.put(u.id, u);
                USER_COLLECTION_CACHE.put(u.id, collectionFor(role));
            }
        }
        for (User u : mongo.find(new Query(Criteria.where("role").is(role)), User.class, "users")) {
            if (u.id != null) {
                byId.putIfAbsent(u.id, u);
                USER_COLLECTION_CACHE.putIfAbsent(u.id, "users");
            }
        }
        return new ArrayList<>(byId.values());
    }

    public boolean existsByRole(Role role) {
        return !findByRole(role).isEmpty();
    }

    /**
     * Consulta optimizada para solicitudes pendientes de verificacion.
     * Solo examina 'farmacias' y 'domiciliarios' con verified: false, omitiendo 'clientes' y 'administradores'.
     */
    public List<User> findPendingVerifications() {
        List<User> list = new ArrayList<>();
        Query q = new Query(Criteria.where("verified").is(false));
        for (User u : mongo.find(q, User.class, "farmacias")) {
            if (u.id != null) {
                list.add(u);
                USER_COLLECTION_CACHE.put(u.id, "farmacias");
            }
        }
        for (User u : mongo.find(q, User.class, "domiciliarios")) {
            if (u.id != null) {
                list.add(u);
                USER_COLLECTION_CACHE.put(u.id, "domiciliarios");
            }
        }
        list.sort(Comparator.comparing((User u) -> u.createdAt,
                Comparator.nullsLast(Comparator.naturalOrder())).reversed());
        return list;
    }

    public List<User> findAll() {
        Map<String, User> allById = new LinkedHashMap<>();
        for (String collection : COLLECTIONS) {
            for (User u : mongo.find(new Query(Criteria.where("role").exists(true)), User.class, collection)) {
                if (u.id != null) {
                    allById.putIfAbsent(u.id, u);
                    USER_COLLECTION_CACHE.putIfAbsent(u.id, collection);
                }
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
