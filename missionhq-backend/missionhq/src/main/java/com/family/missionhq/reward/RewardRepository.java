package com.family.missionhq.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RewardRepository extends JpaRepository<Reward, Long> {
    List<Reward> findByKidIdAndStatusIn(Long kidId, List<Reward.Status> statuses);
    long countByKidIdAndStatus(Long kidId, Reward.Status status);
    Optional<Reward> findByKidIdAndTermGoalTrueAndStatus(Long kidId, Reward.Status status);

    @Query("select r from Reward r join Kid k on k.id = r.kidId where k.householdId = :householdId and r.status = :status order by r.id asc")
    List<Reward> findByHouseholdIdAndStatusOrderByIdAsc(@Param("householdId") Long householdId, @Param("status") Reward.Status status);
}
