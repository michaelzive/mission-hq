package com.family.missionhq.celebration;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CelebrationRepository extends JpaRepository<Celebration, Long> {
    List<Celebration> findByKidIdAndPlayedAtIsNullOrderByCreatedAtAscIdAsc(Long kidId);
}
