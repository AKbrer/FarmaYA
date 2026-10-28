package com.farmaya.repo;

import com.farmaya.model.Movement;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MovementRepository extends MongoRepository<Movement, String> {
    List<Movement> findTop500ByOrderByCreatedAtDesc();
    List<Movement> findTop500ByActorIdOrderByCreatedAtDesc(String actorId);
}
