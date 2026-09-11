package com.family.missionhq.kid;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface KidRepository extends JpaRepository<Kid, Long> {
    List<Kid> findByHouseholdId(Long householdId);
}
