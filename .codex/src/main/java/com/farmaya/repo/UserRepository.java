package com.farmaya.repo;

import com.farmaya.model.Role;
import com.farmaya.model.User;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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
    private static final List<String> COLLECTIONS = List.of(
            "clientes", "farmacias", "domiciliarios", "administradores");

    private final MongoTemplate mongo;

    public UserRepository(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public User save(User user) {
        if (user == null || user.role == null) {
            throw new IllegalArgumentException("La cuenta debe tener un rol antes de guardarse.");
        }
        return mongo.save(user, collectionFor(user.role));
    }

    public Optional<User> findById(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        for (String collection : COLLECTIONS) {
            User user = mongo.findById(id, User.class, collection);
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
        return mongo.find(new Query(Criteria.where("role").is(role)), User.class, collectionFor(role));
    }

    public boolean existsByRole(Role role) {
        return !findByRole(role).isEmpty();
    }

    public List<User> findAll() {
        List<User> all = new ArrayList<>();
        for (String collection : COLLECTIONS) {
            all.addAll(mongo.find(new Query(Criteria.where("role").exists(true)), User.class, collection));
        }
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
