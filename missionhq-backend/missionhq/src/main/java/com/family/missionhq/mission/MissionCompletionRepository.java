package com.family.missionhq.mission;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface MissionCompletionRepository extends JpaRepository<MissionCompletion, Long> {
    List<MissionCompletion> findByKidIdAndBehaviourIdAndMissionDateBetween(Long kidId, Long behaviourId, LocalDate from, LocalDate to);
    List<MissionCompletion> findByKidIdAndMissionDateBetween(Long kidId, LocalDate from, LocalDate to);
    List<MissionCompletion> findByStatusAndPhotoKeyIsNotNullAndReviewedAtBefore(MissionCompletion.Status status, Instant before);

    /** Days that keep a streak alive: at least one approved mission the kid reported themselves. */
    @Query("select distinct c.missionDate from MissionCompletion c where c.kidId = :kidId and c.status = 'APPROVED' and c.loggedByParent = false and c.missionDate >= :since")
    List<LocalDate> streakDays(@Param("kidId") Long kidId, @Param("since") LocalDate since);

    @Query("select c from MissionCompletion c join Kid k on k.id = c.kidId where k.householdId = :householdId and c.status = :status order by c.submittedAt asc")
    List<MissionCompletion> findByHouseholdIdAndStatusOrderBySubmittedAtAsc(@Param("householdId") Long householdId, @Param("status") MissionCompletion.Status status);
}
