package com.family.missionhq.squad;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SquadGoalRepository extends JpaRepository<SquadGoal, Long> {
    Optional<SquadGoal> findFirstByHouseholdIdAndStatusOrderByIdDesc(Long householdId, String status);
}
