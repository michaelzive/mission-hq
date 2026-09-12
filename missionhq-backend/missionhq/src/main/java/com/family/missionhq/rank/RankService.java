package com.family.missionhq.rank;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.cosmetic.CosmeticService;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.PointsAwarded;
import com.family.missionhq.push.PushRequested;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

@Service @RequiredArgsConstructor
public class RankService {
    private final RankDefinitionRepository ranks;
    private final KidRepository kids;
    private final CelebrationService celebrations;
    private final CosmeticService cosmetics;
    private final ApplicationEventPublisher events;

    public record RankView(String name, int ordinal, String nextName, Integer pointsToNext) {}

    /** Pure function: which rank does this lifetime total earn on this ladder? */
    public static int ordinalFor(List<RankDefinition> ladder, int lifetime) {
        int ord = 0;
        for (var r : ladder) if (lifetime >= r.getThreshold()) ord = r.getOrdinal();
        return ord;
    }

    public RankView view(Kid kid) {
        var ladder = ranks.findByThemeCodeOrderByOrdinalAsc(kid.getThemeCode());
        var current = ladder.get(Math.min(kid.getRankOrdinal(), ladder.size() - 1));
        var next = ladder.stream().filter(r -> r.getOrdinal() == current.getOrdinal() + 1).findFirst();
        return new RankView(current.getName(), current.getOrdinal(),
                next.map(RankDefinition::getName).orElse(null),
                next.map(r -> r.getThreshold() - kid.getLifetimeEarned()).orElse(null));
    }

    /** Runs inside the awarding transaction (BEFORE_COMMIT) so the rank-up celebration is queued atomically after the points one. */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onPointsAwarded(PointsAwarded ev) {
        var kid = kids.findById(ev.kidId()).orElseThrow();
        var ladder = ranks.findByThemeCodeOrderByOrdinalAsc(kid.getThemeCode());
        int newOrd = ordinalFor(ladder, ev.lifetimeAfter());
        if (newOrd == kid.getRankOrdinal()) return;
        int oldOrd = kid.getRankOrdinal();
        kid.setRankOrdinal(newOrd);
        kids.save(kid);
        if (newOrd > oldOrd) {
            var name = ladder.get(newOrd).getName();
            for (int o = oldOrd + 1; o <= newOrd; o++) cosmetics.grantRankUnlocks(kid, o);
            celebrations.rankUp(kid, name);
            kids.findByHouseholdId(kid.getHouseholdId()).stream()
                    .filter(s -> !s.getId().equals(kid.getId()))
                    .forEach(s -> { celebrations.siblingRankUp(s, kid.getCallsign(), name); events.publishEvent(PushRequested.kid(s.getId(), "Squad news", kid.getCallsign() + " just made " + name, "/squad")); });
            events.publishEvent(PushRequested.parents(kid.getHouseholdId(), kid.getCallsign() + " ranked up", "Now " + name, "/kids"));
        }
    }
}
