package com.farmaya.repo;

import com.farmaya.model.Administrador;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AdministradorRepository extends MongoRepository<Administrador, String> {
    Optional<Administrador> findByEmailIgnoreCase(String email);
}
