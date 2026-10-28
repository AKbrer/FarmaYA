package com.farmaya.repo;

import com.farmaya.model.Order;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findTop100ByClientIdOrderByCreatedAtDesc(String clientId);
}
