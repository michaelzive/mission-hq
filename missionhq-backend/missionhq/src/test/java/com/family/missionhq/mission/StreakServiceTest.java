package com.family.missionhq.mission;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StreakServiceTest {
    // 2026-10-05 is a Monday
    static final LocalDate MON = LocalDate.of(2026, 10, 5), TUE = MON.plusDays(1), WED = MON.plusDays(2), THU = MON.plusDays(3), SUN_BEFORE = MON.minusDays(1);

    static int streak(List<LocalDate> days, LocalDate today, boolean lateOpen) { return StreakService.walk(days, today, lateOpen).days().size(); }

    @Test void noHistoryIsNoStreak() {
        assertThat(streak(List.of(), WED, false)).isZero();
    }

    @Test void todayNotDoneYetDoesNotBreakIt() {
        assertThat(streak(List.of(MON, TUE), WED, false)).isEqualTo(2);
        assertThat(streak(List.of(MON, TUE, WED), WED, false)).isEqualTo(3);
    }

    @Test void yesterdayDoesNotBreakItWhileItCanStillBeReported() {
        assertThat(streak(List.of(MON), WED, true)).isEqualTo(1);
    }

    @Test void oneMissedDayAWeekIsBridgedByTheFreeze() {
        var run = StreakService.walk(List.of(MON, WED), THU, false);
        assertThat(run.days()).containsExactly(MON, WED);
        assertThat(run.frozenWeeks()).containsExactly(MON);
    }

    @Test void aSecondMissInTheSameWeekEndsTheRun() {
        var fri = LocalDate.of(2026, 10, 9);
        // Thu missed (freeze), Tue missed (no freeze left this week): the run is Wed..Fri
        assertThat(StreakService.walk(List.of(SUN_BEFORE.minusDays(1), MON, WED, fri), fri, false).days()).containsExactly(WED, fri);
    }

    @Test void twoMissedDaysInARowEndTheRunUnlessTheyStraddleTwoWeeks() {
        assertThat(streak(List.of(MON, THU), THU, false)).isEqualTo(1);
        // Sat + Sun missed (one week), then Mon done: the second miss in that week ends it
        assertThat(streak(List.of(SUN_BEFORE.minusDays(2), MON), MON, false)).isEqualTo(1);
        // Sun missed (last week) and Mon missed (this week): each week spends its own freeze
        assertThat(streak(List.of(SUN_BEFORE.minusDays(1), TUE), TUE, false)).isEqualTo(2);
    }

    @Test void aFreezeThatBridgesNothingIsNotSpent() {
        // Mon and Tue both missed, nothing before: no run, and this week's freeze is still there
        var run = StreakService.walk(List.of(SUN_BEFORE.minusDays(5)), WED, false);
        assertThat(run.days()).isEmpty();
        assertThat(run.frozenWeeks()).doesNotContain(MON);
    }

    @Test void daysComeBackOldestFirstForMilestones() {
        var week = List.of(MON, TUE, WED, THU, THU.plusDays(1), THU.plusDays(2), THU.plusDays(3));
        assertThat(StreakService.walk(week, THU.plusDays(3), false).days()).containsExactlyElementsOf(week);
    }
}
