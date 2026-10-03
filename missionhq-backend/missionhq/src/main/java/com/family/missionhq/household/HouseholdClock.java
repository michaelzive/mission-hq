package com.family.missionhq.household;

import com.family.missionhq.common.DomainException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;

/**
 * "Now" and "today" as the family sees them. The server runs in UTC, so anything a kid experiences as a day
 * (which missions show, the late-report window, the streak, the evening reminder) must come from here.
 */
@Component @RequiredArgsConstructor
public class HouseholdClock {
    /** Yesterday's missions can still be reported until this local time. */
    public static final LocalTime LATE_REPORT_UNTIL = LocalTime.NOON;

    private final HouseholdRepository households;
    private final Clock clock;

    public ZonedDateTime now(Household hh) { return ZonedDateTime.now(clock.withZone(hh.zone())); }
    public ZonedDateTime now(Long householdId) { return now(households.findById(householdId).orElseThrow(() -> DomainException.notFound("household"))); }
    public LocalDate today(Long householdId) { return now(householdId).toLocalDate(); }

    /** Yesterday while the late-report window is open, otherwise null. */
    public LocalDate lateDate(Long householdId) {
        var now = now(householdId);
        return now.toLocalTime().isBefore(LATE_REPORT_UNTIL) ? now.toLocalDate().minusDays(1) : null;
    }

    /** A kid may report today, or yesterday until {@link #LATE_REPORT_UNTIL}. */
    public boolean kidMayReport(Long householdId, LocalDate date) {
        return date.equals(today(householdId)) || date.equals(lateDate(householdId));
    }
}
