package com.family.missionhq.mission;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MissionCompletionRepository extends JpaRepository<MissionCompletion, Long> {
    Optional<MissionCompletion> findByKidIdAndBehaviourIdAndMissionDate(Long kidId, Long behaviourId, LocalDate date);
    List<MissionCompletion> findByKidIdAndMissionDate(Long kidId, LocalDate date);
    List<MissionCompletion> findByStatusOrderBySubmittedAtAsc(MissionCompletion.Status status);
    List<MissionCompletion> findByStatusAndPhotoKeyIsNotNullAndReviewedAtBefore(MissionCompletion.Status status, Instant before);
    boolean existsByKidIdAndMissionDateAndStatus(Long kidId, LocalDate date, MissionCompletion.Status status);
}
