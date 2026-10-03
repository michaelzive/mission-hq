package com.family.missionhq.household;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ParentInviteRepository extends JpaRepository<ParentInvite, Long> {
    Optional<ParentInvite> findByTokenHash(String tokenHash);
    /** Locks the invite row so two people opening the same link can't both accept it. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ParentInvite> findForUpdateByTokenHash(String tokenHash);
    List<ParentInvite> findByHouseholdIdAndAcceptedAtIsNullAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtAsc(Long householdId, Instant now);
    List<ParentInvite> findByKindAndCreatedByAndAcceptedAtIsNullAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtAsc(ParentInvite.Kind kind, Long createdBy, Instant now);
}
