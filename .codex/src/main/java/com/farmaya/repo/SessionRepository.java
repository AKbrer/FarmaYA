package com.farmaya.repo;

import com.farmaya.model.Session;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SessionRepository extends MongoRepository<Session, String> {
    List<Session> findByUserId(String userId);
}
