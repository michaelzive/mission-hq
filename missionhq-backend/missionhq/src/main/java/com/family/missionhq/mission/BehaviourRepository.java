package com.family.missionhq.mission;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BehaviourRepository extends JpaRepository<Behaviour, Long> {
    List<Behaviour> findByHouseholdIdAndActiveTrue(Long householdId);
}
