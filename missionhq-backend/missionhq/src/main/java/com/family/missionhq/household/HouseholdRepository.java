package com.family.missionhq.household;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

public interface HouseholdRepository extends JpaRepository<Household, Long> {
    /** 1 if this caller gets to send today's reminder, 0 if another instance (or an earlier tick) already did. */
    @Modifying
    @Query("update Household h set h.lastReminderDate = :today where h.id = :id and (h.lastReminderDate is null or h.lastReminderDate < :today)")
    int claimReminder(@Param("id") Long id, @Param("today") LocalDate today);
}
