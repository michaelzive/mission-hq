package com.family.missionhq.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RewardRepository extends JpaRepository<Reward, Long> {
    long countByKidIdAndStatus(Long kidId, Reward.Status status);
    Optional<Reward> findByKidIdAndTermGoalTrueAndStatus(Long kidId, Reward.Status status);
    List<Reward> findByKidIdAndStatusIn(Long kidId, List<Reward.Status> statuses);

    /** A kid's shop: their own rewards plus the household's shared ones. */
    @Query("select r from Reward r where (r.kidId = :kidId or r.householdId = :householdId) and r.status in :statuses")
    List<Reward> findCatalogue(@Param("kidId") Long kidId, @Param("householdId") Long householdId, @Param("statuses") List<Reward.Status> statuses);

    @Query("select r from Reward r join Kid k on k.id = r.kidId where k.householdId = :householdId and r.status = :status order by r.id asc")
    List<Reward> findByHouseholdIdAndStatusOrderByIdAsc(@Param("householdId") Long householdId, @Param("status") Reward.Status status);

    @Query("select r from Reward r left join Kid k on k.id = r.kidId where (k.householdId = :householdId or r.householdId = :householdId) and r.status in :statuses order by r.kidId asc nulls first, r.termGoal desc, r.status asc, r.price asc, r.id asc")
    List<Reward> findByHouseholdIdAndStatusIn(@Param("householdId") Long householdId, @Param("statuses") List<Reward.Status> statuses);
}
