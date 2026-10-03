package com.family.missionhq.mission;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.Household;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.household.Parent;
import com.family.missionhq.household.ParentRepository;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.kid.KidService;
import com.family.missionhq.push.PushRequested;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Late reports, parent-logging, trusted (photo-less) missions, weekly missions, the rebuilt streak and the evening reminder. Requires Docker. */
@SpringBootTest @Testcontainers @ActiveProfiles("dev") @RecordApplicationEvents
class EngagementIT {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");
    static final LocalDate MON = LocalDate.of(2026, 10, 5), TUE = MON.plusDays(1), WED = MON.plusDays(2);

    @TestConfiguration static class Clocks {
        @Bean @Primary MutableClock testClock() { return new MutableClock(); }
    }

    @Autowired MutableClock clock;
    @Autowired MissionService missions;
    @Autowired BehaviourService behaviours;
    @Autowired StreakService streaks;
    @Autowired MissionReminder reminder;
    @Autowired KidService kidService;
    @Autowired KidRepository kids;
    @Autowired HouseholdRepository households;
    @Autowired ParentRepository parents;
    @Autowired ApplicationEvents events;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    Parent dad;

    @BeforeEach void setup() {
        dad = parents.findByEmail("dad@example.com").orElseThrow();   // household 1, Africa/Johannesburg by default
        at(WED, 10, 0);
    }

    @Test void aMissionWithNoPhotoIsApprovedOnTheSpotAndCountsForTheStreak() {
        var kid = newKid();
        var bed = mission(kid, "Make bed", 10, Behaviour.Kind.DAILY, false);
        var c = missions.submit(kid, bed.getId(), WED, null);
        assertThat(c.getStatus()).isEqualTo(MissionCompletion.Status.APPROVED);
        assertThat(c.getReviewedBy()).isNull();
        kid = reload(kid);
        assertThat(kid.getBalance()).isEqualTo(10);
        assertThat(streaks.current(kid).days()).isEqualTo(1);
    }

    @Test void aParentLoggedMissionPaysTheReducedRateAndSkipsTheStreak() {
        var kid = newKid();
        var dishes = mission(kid, "Dishes", 15, Behaviour.Kind.DAILY, true);
        var c = missions.logForKid(dad, kid, dishes.getId(), WED);
        assertThat(c.isLoggedByParent()).isTrue();
        assertThat(c.getPointsAwarded()).isEqualTo(8);   // 50% of 15, rounded up
        kid = reload(kid);
        assertThat(kid.getBalance()).isEqualTo(8);
        assertThat(streaks.current(kid).days()).isZero();
        var card = card(kid, dishes, WED);
        assertThat(card.status()).isEqualTo("APPROVED");
        assertThat(card.loggedByParent()).isTrue();
        var k = kid;
        assertThatThrownBy(() -> missions.submit(k, dishes.getId(), WED, "photo")).isInstanceOf(DomainException.class);
    }

    @Test void loggingAMissionTheKidAlreadyReportedApprovesTheirReportAtFullPoints() {
        var kid = newKid();
        var homework = mission(kid, "Homework", 20, Behaviour.Kind.DAILY, true);
        missions.submit(kid, homework.getId(), WED, "photo");
        var c = missions.logForKid(dad, kid, homework.getId(), WED);
        assertThat(c.isLoggedByParent()).isFalse();
        assertThat(c.getPointsAwarded()).isEqualTo(20);
        assertThat(streaks.current(reload(kid)).days()).isEqualTo(1);
    }

    @Test void yesterdayCanBeReportedUntilNoonButNoEarlier() {
        var kid = newKid();
        var reading = mission(kid, "Reading", 10, Behaviour.Kind.DAILY, true);
        at(WED, 11, 59);
        missions.submit(kid, reading.getId(), TUE, "photo");
        at(WED, 12, 0);
        assertThatThrownBy(() -> missions.submit(kid, reading.getId(), TUE, "photo")).hasMessageContaining("no longer be reported");
        at(WED, 9, 0);
        assertThatThrownBy(() -> missions.submit(kid, reading.getId(), MON, "photo")).hasMessageContaining("no longer be reported");
        assertThatThrownBy(() -> missions.submit(kid, reading.getId(), WED.plusDays(1), "photo")).hasMessageContaining("no longer be reported");
    }

    @Test void aLateReportApprovedOutOfOrderStillKeepsTheStreak() {
        var kid = newKid();
        var chore = mission(kid, "Chore", 10, Behaviour.Kind.DAILY, true);
        at(MON, 18, 0);
        missions.approve(missions.submit(kid, chore.getId(), MON, "photo").getId(), dad, 0);
        at(WED, 8, 0);
        var today = missions.submit(kid, chore.getId(), WED, "photo");      // reported first...
        var late = missions.submit(kid, chore.getId(), TUE, "photo");       // ...then yesterday's, late
        missions.approve(today.getId(), dad, 0);                           // approved in queue order
        missions.approve(late.getId(), dad, 0);
        var streak = streaks.current(reload(kid));
        assertThat(streak.days()).isEqualTo(3);
        assertThat(streak.freezeReady()).isTrue();
    }

    @Test void aSevenDayMilestoneIsPaidOnceEvenWhenTheStreakIsRecomputed() {
        var kid = newKid();
        var chore = mission(kid, "Chore", 10, Behaviour.Kind.DAILY, false);
        for (int i = 6; i >= 0; i--) { at(WED.minusDays(i), 18, 0); missions.submit(kid, chore.getId(), WED.minusDays(i), null); }
        kid = reload(kid);
        assertThat(kid.getStreakDays()).isEqualTo(7);
        assertThat(kid.getBalance()).isEqualTo(7 * 10 + StreakService.MILESTONE_BONUS);
        streaks.afterApproval(kid, null);
        assertThat(reload(kid).getBalance()).isEqualTo(7 * 10 + StreakService.MILESTONE_BONUS);
    }

    @Test void aWeeklyMissionStaysDoneUntilMonday() {
        var kid = newKid();
        var room = mission(kid, "Tidy room", 30, Behaviour.Kind.WEEKLY, false);
        at(MON, 17, 0);
        missions.submit(kid, room.getId(), MON, null);
        at(WED, 17, 0);
        assertThat(card(kid, room, WED).status()).isEqualTo("APPROVED");
        assertThat(card(kid, room, WED).weekly()).isTrue();
        assertThatThrownBy(() -> missions.submit(kid, room.getId(), WED, null)).hasMessageContaining("this week");
        at(MON.plusWeeks(1), 17, 0);
        assertThat(card(kid, room, MON.plusWeeks(1)).status()).isEqualTo("TODO");
    }

    @Test void theEveningReminderGoesOnceAndOnlyToKidsWithMissionsLeft() {
        var hh = new Household(); hh.setName("Reminder family"); households.save(hh);
        var p = new Parent(); p.setHouseholdId(hh.getId()); p.setName("Mum"); p.setEmail("mum-" + hh.getId() + "@example.com"); p.setPasswordHash("x");
        p = parents.save(p);
        var busy = kidService.create(hh.getId(), "Busy", "HERO");
        var done = kidService.create(hh.getId(), "Done", "HERO");
        behaviours.create(p, busy, new BehaviourService.Input("Feed the dog", 10, Behaviour.Kind.DAILY, true, null, true));
        var tidy = behaviours.create(p, done, new BehaviourService.Input("Tidy up", 10, Behaviour.Kind.DAILY, false, null, true));
        at(WED, 17, 0);
        missions.submit(done, tidy.getId(), WED, null);

        at(WED, 18, 0);
        reminder.tick();
        assertThat(remindersTo(busy, done)).isZero();

        at(WED, 18, 40);
        reminder.tick();
        reminder.tick();
        assertThat(remindersTo(busy)).isEqualTo(1);
        assertThat(remindersTo(done)).isZero();
    }

    @Test void theReminderTimeIsStoredAsTheWallClockTimeWhateverTheServersZone() {
        var hh = new Household(); hh.setName("Clock family"); hh.setReminderTime(java.time.LocalTime.of(19, 0)); households.save(hh);
        assertThat(jdbc.queryForObject("select reminder_time from household where id = ?", String.class, hh.getId())).isEqualTo("19:00");
        assertThat(households.findById(hh.getId()).orElseThrow().getReminderTime()).isEqualTo(java.time.LocalTime.of(19, 0));
    }

    private long remindersTo(Kid... targets) {
        var ids = java.util.Arrays.stream(targets).map(Kid::getId).toList();
        return events.stream(PushRequested.class).filter(e -> ids.contains(e.ownerId()) && e.title().contains("still open")).count();
    }

    private Kid newKid() { return kidService.create(dad.getHouseholdId(), "K" + System.nanoTime() % 100000, "AIRSOFT"); }
    private Kid reload(Kid kid) { return kids.findById(kid.getId()).orElseThrow(); }
    private Behaviour mission(Kid kid, String title, int points, Behaviour.Kind kind, boolean photo) {
        return behaviours.create(dad, kid, new BehaviourService.Input(title, points, kind, photo, null, true));
    }
    private MissionService.MissionCard card(Kid kid, Behaviour b, LocalDate date) {
        return missions.cardsFor(kid, date).stream().filter(c -> c.behaviourId().equals(b.getId())).findFirst().orElseThrow();
    }
    private void at(LocalDate date, int hour, int minute) { clock.set(LocalDateTime.of(date, java.time.LocalTime.of(hour, minute)).atZone(SAST).toInstant()); }

    static class MutableClock extends Clock {
        private Instant now = Instant.now();
        void set(Instant i) { now = i; }
        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { var self = this; return new Clock() {
            @Override public ZoneId getZone() { return zone; }
            @Override public Clock withZone(ZoneId z) { return self.withZone(z); }
            @Override public Instant instant() { return self.now; }
        }; }
        @Override public Instant instant() { return now; }
    }
}
