package com.farmaya.repo;

import com.farmaya.model.Disbursement;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DisbursementRepository extends MongoRepository<Disbursement, String> {
    List<Disbursement> findByPharmacyIdOrderByCreatedAtDesc(String pharmacyId);
    List<Disbursement> findAllByOrderByCreatedAtDesc();
    long count();
}
