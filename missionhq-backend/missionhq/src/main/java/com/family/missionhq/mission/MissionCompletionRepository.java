package com.family.missionhq.mission;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MissionCompletionRepository extends JpaRepository<MissionCompletion, Long> {
    Optional<MissionCompletion> findByKidIdAndBehaviourIdAndMissionDate(Long kidId, Long behaviourId, LocalDate date);
    List<MissionCompletion> findByKidIdAndMissionDate(Long kidId, LocalDate date);
    List<MissionCompletion> findByStatusAndPhotoKeyIsNotNullAndReviewedAtBefore(MissionCompletion.Status status, Instant before);
    boolean existsByKidIdAndMissionDateAndStatus(Long kidId, LocalDate date, MissionCompletion.Status status);

    @Query("select c from MissionCompletion c join Kid k on k.id = c.kidId where k.householdId = :householdId and c.status = :status order by c.submittedAt asc")
    List<MissionCompletion> findByHouseholdIdAndStatusOrderBySubmittedAtAsc(@Param("householdId") Long householdId, @Param("status") MissionCompletion.Status status);
}
