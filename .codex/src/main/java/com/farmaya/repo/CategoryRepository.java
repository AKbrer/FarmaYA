package com.farmaya.repo;

import com.farmaya.model.Category;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CategoryRepository extends MongoRepository<Category, String> {
    List<Category> findByActiveTrueOrderBySortOrderAscNameAsc();
    Optional<Category> findByCode(String code);
}
