package com.family.missionhq.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RedemptionRepository extends JpaRepository<Redemption, Long> {
    List<Redemption> findByFulfilledAtIsNullOrderByRedeemedAtAsc();
}
