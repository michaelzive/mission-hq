package com.family.missionhq.mission;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.household.HouseholdClock;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.LedgerService;
import com.family.missionhq.ledger.PointEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * A streak is a run of days with at least one approved mission the kid reported themselves (parent-logged ones don't
 * count). It is recomputed from history rather than nudged up per approval, so approving out of order, or a late
 * report for yesterday, lands on the right day. One missed day per Monday-to-Sunday week is bridged by a freeze.
 */
@Service @RequiredArgsConstructor
public class StreakService {
    static final int MILESTONE_DAYS = 7;
    static final int MILESTONE_BONUS = 25;
    private static final int LOOKBACK_DAYS = 730;

    private final MissionCompletionRepository completions;
    private final KidRepository kids;
    private final LedgerService ledger;
    private final CelebrationService celebrations;
    private final HouseholdClock clock;

    /** freezeReady: this week's freeze hasn't been spent bridging a gap in the current streak. */
    public record Streak(int days, boolean freezeReady) {}

    @Transactional(readOnly = true)
    public Streak current(Kid kid) {
        var run = run(kid);
        return new Streak(run.days().size(), !run.frozenWeeks().contains(weekOf(clock.today(kid.getHouseholdId()))));
    }

    /** Call after any approval that can count toward the streak: refreshes the cached count and pays milestones not yet paid. */
    @Transactional
    public void afterApproval(Kid kid, Long parentId) {
        var run = run(kid);
        var days = run.days();
        kid.setStreakDays(days.size());
        kid.setStreakLastDate(days.isEmpty() ? null : days.getLast());
        for (int m = MILESTONE_DAYS; m <= days.size(); m += MILESTONE_DAYS) {
            var reachedOn = days.get(m - 1);
            if (kid.getStreakBonusThrough() != null && !reachedOn.isAfter(kid.getStreakBonusThrough())) continue;
            ledger.award(kid, MILESTONE_BONUS, PointEntry.Type.STREAK_BONUS, null, m + " day streak", parentId);
            celebrations.streak(kid, m, MILESTONE_BONUS);
            kid.setStreakBonusThrough(reachedOn);
        }
        kids.save(kid);
    }

    private Run run(Kid kid) {
        var today = clock.today(kid.getHouseholdId());
        var late = clock.lateDate(kid.getHouseholdId());
        return walk(completions.streakDays(kid.getId(), today.minusDays(LOOKBACK_DAYS)), today, late != null);
    }

    /** days: qualifying days, oldest first. frozenWeeks: Mondays of the weeks whose freeze this run spent. */
    record Run(List<LocalDate> days, Set<LocalDate> frozenWeeks) {}

    /**
     * Walks back from today. Today never breaks a streak (the day isn't over), and nor does yesterday while it can
     * still be reported late. Any other missed day is bridged if its week's freeze is unspent, otherwise the run ends.
     * A freeze only counts as spent once an earlier qualifying day proves it bridged something.
     */
    static Run walk(Collection<LocalDate> qualifying, LocalDate today, boolean yesterdayStillOpen) {
        var have = new HashSet<>(qualifying);
        var earliest = have.stream().min(LocalDate::compareTo).orElse(null);
        var days = new ArrayList<LocalDate>();
        var spent = new HashSet<LocalDate>();
        var pending = new HashSet<LocalDate>();
        if (earliest == null) return new Run(days, spent);

        var cursor = today;
        if (!have.contains(cursor)) {
            cursor = cursor.minusDays(1);
            if (yesterdayStillOpen && !have.contains(cursor)) cursor = cursor.minusDays(1);
        }
        for (; !cursor.isBefore(earliest); cursor = cursor.minusDays(1)) {
            if (have.contains(cursor)) {
                days.add(cursor);
                spent.addAll(pending);
                pending.clear();
            } else {
                var week = weekOf(cursor);
                if (spent.contains(week) || pending.contains(week)) break;
                pending.add(week);
            }
        }
        return new Run(days.reversed(), spent);
    }

    static LocalDate weekOf(LocalDate d) { return d.with(DayOfWeek.MONDAY); }
}
