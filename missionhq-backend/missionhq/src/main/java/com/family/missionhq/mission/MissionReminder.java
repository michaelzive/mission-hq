package com.family.missionhq.mission;

import com.family.missionhq.household.HouseholdClock;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.push.PushRequested;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

/**
 * The evening nudge: at each household's reminder time, every kid with missions still open today gets one push.
 * Kids with nothing left get nothing, so the push never turns into noise.
 *
 * Cloud Run scales to zero, so the @Scheduled tick only fires while an instance happens to be up; Cloud Scheduler
 * calling POST /api/v1/internal/tick is the reliable trigger. Both are safe together: claimReminder lets one through a day.
 */
@Component @RequiredArgsConstructor
public class MissionReminder {
    /** A tick that comes later than this after the reminder time skips the day rather than nag at bedtime. */
    static final Duration WINDOW = Duration.ofHours(2);

    private final HouseholdRepository households;
    private final KidRepository kids;
    private final MissionService missions;
    private final HouseholdClock clock;
    private final ApplicationEventPublisher events;

    /** Returns how many kids were reminded. */
    @Scheduled(cron = "0 */15 * * * *")
    @Transactional
    public int tick() {
        int sent = 0;
        for (var hh : households.findAll()) {
            if (hh.getReminderTime() == null) continue;
            var now = clock.now(hh);
            var at = now.toLocalDate().atTime(hh.getReminderTime()).atZone(hh.zone());
            if (now.isBefore(at) || !now.isBefore(at.plus(WINDOW))) continue;
            if (households.claimReminder(hh.getId(), now.toLocalDate()) == 0) continue;
            for (var kid : kids.findByHouseholdId(hh.getId())) {
                long open = missions.cardsFor(kid, now.toLocalDate()).stream().filter(c -> c.status().equals("TODO")).count();
                if (open == 0) continue;
                var title = open == 1 ? "1 mission still open" : open + " missions still open";
                events.publishEvent(PushRequested.kid(kid.getId(), title, "Done it already? Report in to HQ before lights out.", "/hq"));
                sent++;
            }
        }
        return sent;
    }
}
