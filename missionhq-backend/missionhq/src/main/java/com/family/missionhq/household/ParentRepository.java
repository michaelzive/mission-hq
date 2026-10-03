package com.family.missionhq.household;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ParentRepository extends JpaRepository<Parent, Long> {
    Optional<Parent> findByEmail(String email);
    Optional<Parent> findByEmailIgnoreCase(String email);
    Optional<Parent> findByFirebaseUid(String firebaseUid);
    List<Parent> findByHouseholdId(Long householdId);
}
