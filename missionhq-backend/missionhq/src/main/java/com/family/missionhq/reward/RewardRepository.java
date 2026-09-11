package com.family.missionhq.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RewardRepository extends JpaRepository<Reward, Long> {
    List<Reward> findByKidIdAndStatusIn(Long kidId, List<Reward.Status> statuses);
    long countByKidIdAndStatus(Long kidId, Reward.Status status);
    List<Reward> findByStatusOrderByIdAsc(Reward.Status status);
    Optional<Reward> findByKidIdAndTermGoalTrueAndStatus(Long kidId, Reward.Status status);
}
