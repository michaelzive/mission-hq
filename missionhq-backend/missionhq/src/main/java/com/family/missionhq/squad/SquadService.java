package com.family.missionhq.squad;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.PointEntryRepository;
import com.family.missionhq.ledger.PointsAwarded;
import com.family.missionhq.push.PushRequested;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Optional;

/** The shared goal both kids fill. Milestones at 25/50/75/100% celebrate on every tablet. */
@Service @RequiredArgsConstructor
public class SquadService {
    private static final int[] MILESTONES = {25, 50, 75, 100};

    private final SquadGoalRepository goals;
    private final PointEntryRepository ledger;
    private final KidRepository kids;
    private final CelebrationService celebrations;
    private final ApplicationEventPublisher events;

    public record Progress(Long id, String name, int target, int progress, int percent) {}

    @Transactional(readOnly = true)
    public Optional<Progress> progress(Long householdId) {
        return goals.findFirstByHouseholdIdAndStatusOrderByIdDesc(householdId, "ACTIVE").map(g -> {
            int p = ledger.householdLifetime(householdId);
            return new Progress(g.getId(), g.getName(), g.getTargetPoints(), Math.min(p, g.getTargetPoints()), Math.min(100, p * 100 / Math.max(1, g.getTargetPoints())));
        });
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onPointsAwarded(PointsAwarded ev) {
        if (ev.points() <= 0) return;
        var kid = kids.findById(ev.kidId()).orElseThrow();
        var goal = goals.findFirstByHouseholdIdAndStatusOrderByIdDesc(kid.getHouseholdId(), "ACTIVE").orElse(null);
        if (goal == null) return;
        int after = ledger.householdLifetime(kid.getHouseholdId());
        int before = after - ev.points();
        int target = Math.max(1, goal.getTargetPoints());
        for (int m : MILESTONES) {
            int threshold = target * m / 100;
            if (before < threshold && after >= threshold) {
                var squad = kids.findByHouseholdId(kid.getHouseholdId());
                squad.forEach(k -> celebrations.squadMilestone(k, goal.getName(), m));
                squad.forEach(k -> events.publishEvent(PushRequested.kid(k.getId(), "Squad goal " + m + "%", goal.getName(), "/squad")));
                if (m == 100) events.publishEvent(PushRequested.parents("Squad goal reached", goal.getName() + " — time to book it", "/kids"));
            }
        }
    }
}
