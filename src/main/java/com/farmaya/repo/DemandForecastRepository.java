package com.farmaya.repo;

import com.farmaya.model.DemandForecast;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DemandForecastRepository extends MongoRepository<DemandForecast, String> {
    Optional<DemandForecast> findByMedicineNameIgnoreCase(String medicineName);
    List<DemandForecast> findByCategoryIgnoreCase(String category);
    List<DemandForecast> findAllByOrderByEstimatedOrdersDesc();
}
