package com.family.missionhq.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RedemptionRepository extends JpaRepository<Redemption, Long> {
    List<Redemption> findByFulfilledAtIsNullOrderByRedeemedAtAsc();
    boolean existsByKidIdAndRewardId(Long kidId, Long rewardId);

    @Query("select r from Redemption r join Kid k on k.id = r.kidId where k.householdId = :householdId and r.fulfilledAt is null order by r.redeemedAt asc")
    List<Redemption> findOpenByHouseholdId(@Param("householdId") Long householdId);
}
