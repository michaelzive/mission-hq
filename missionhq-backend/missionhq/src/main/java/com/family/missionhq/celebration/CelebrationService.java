package com.family.missionhq.celebration;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.kid.Kid;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service @RequiredArgsConstructor
public class CelebrationService {
    private final CelebrationRepository repo;

    /** payload carries the behaviourId so the kid app can animate from the exact card. */
    public void missionApproved(Kid kid, Long completionId, int points, Long behaviourId) { add(kid, Celebration.Type.MISSION_APPROVED, points, completionId, String.valueOf(behaviourId)); }
    public void bonus(Kid kid, int points, String reason) { add(kid, Celebration.Type.BONUS, points, null, reason); }
    public void streak(Kid kid, int days, int points) { add(kid, Celebration.Type.STREAK, points, null, days + " day streak"); }
    public void rankUp(Kid kid, String rankName) { add(kid, Celebration.Type.RANK_UP, null, null, rankName); }
    public void siblingRankUp(Kid sibling, String callsign, String rankName) { add(sibling, Celebration.Type.SIBLING_RANK_UP, null, null, callsign + " is now " + rankName); }
    public void redeemed(Kid kid, Long redemptionId, int tier, String name) { add(kid, Celebration.Type.REDEEMED, tier, redemptionId, name); }
    public void squadMilestone(Kid kid, String goalName, int percent) { add(kid, Celebration.Type.SQUAD_MILESTONE, percent, null, goalName + " " + percent + "%"); }
    public void highFive(Kid to, String fromCallsign) { add(to, Celebration.Type.HIGH_FIVE, null, null, fromCallsign); }

    @Transactional(readOnly = true)
    public List<Celebration> unplayed(Long kidId) { return repo.findByKidIdAndPlayedAtIsNullOrderByCreatedAtAscIdAsc(kidId); }

    @Transactional
    public void ack(Long kidId, Long id) {
        var c = repo.findById(id).orElseThrow(() -> DomainException.notFound("celebration"));
        if (!c.getKidId().equals(kidId)) throw DomainException.forbidden("not yours");
        c.setPlayedAt(Instant.now());
    }

    private void add(Kid kid, Celebration.Type type, Integer points, Long refId, String payload) {
        var c = new Celebration();
        c.setKidId(kid.getId()); c.setType(type); c.setPoints(points); c.setRefId(refId); c.setPayload(payload);
        repo.save(c);
    }
}
