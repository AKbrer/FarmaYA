package com.farmaya.repo;

import com.farmaya.model.Product;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends MongoRepository<Product, String> {
    Optional<Product> findByNameIgnoreCase(String name);
    List<Product> findByCat(String cat);
}
