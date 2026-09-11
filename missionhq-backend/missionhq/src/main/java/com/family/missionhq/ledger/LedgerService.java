package com.family.missionhq.ledger;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The only class allowed to write PointEntry rows or touch the cached balance fields on Kid.
 * Rules: earned points are never deducted; spending reduces balance only, never lifetime.
 */
@Service @RequiredArgsConstructor
public class LedgerService {
    private final PointEntryRepository entries;
    private final KidRepository kids;
    private final ApplicationEventPublisher events;

    @Transactional
    public PointEntry award(Kid kid, int points, PointEntry.Type type, Long refId, String reason, Long by) {
        if (points <= 0) throw DomainException.badRequest("award must be positive");
        if (type == PointEntry.Type.REDEMPTION || type == PointEntry.Type.CORRECTION) throw DomainException.badRequest("wrong entry type for award");
        var e = write(kid.getId(), points, type, refId, reason, by);
        kid.setBalance(kid.getBalance() + points);
        kid.setLifetimeEarned(kid.getLifetimeEarned() + points);
        kids.save(kid);
        events.publishEvent(new PointsAwarded(kid.getId(), points, kid.getLifetimeEarned()));
        return e;
    }

    @Transactional
    public PointEntry spend(Kid kid, int points, Long redemptionId) {
        if (points <= 0) throw DomainException.badRequest("spend must be positive");
        if (kid.getBalance() < points) throw DomainException.conflict("not enough points");
        var e = write(kid.getId(), -points, PointEntry.Type.REDEMPTION, redemptionId, "redeemed", null);
        kid.setBalance(kid.getBalance() - points);
        kids.save(kid);
        return e;
    }

    /** Parent-only escape hatch. Hidden from kids. Reduces lifetime too, which may lower rank. */
    @Transactional
    public PointEntry correct(Kid kid, int delta, String reason, Long parentId) {
        if (delta == 0) throw DomainException.badRequest("delta cannot be zero");
        var e = write(kid.getId(), delta, PointEntry.Type.CORRECTION, null, reason, parentId);
        kid.setBalance(kid.getBalance() + delta);
        if (delta > 0) kid.setLifetimeEarned(kid.getLifetimeEarned() + delta);
        else kid.setLifetimeEarned(Math.max(0, kid.getLifetimeEarned() + delta));
        kids.save(kid);
        events.publishEvent(new PointsAwarded(kid.getId(), delta, kid.getLifetimeEarned()));
        return e;
    }

    /** Rebuild the cached fields from the ledger. Run nightly or after a suspected drift. */
    @Transactional
    public void reconcile(Kid kid) {
        kid.setBalance(entries.balanceOf(kid.getId()));
        kid.setLifetimeEarned(entries.lifetimeOf(kid.getId()));
        kids.save(kid);
    }

    private PointEntry write(Long kidId, int points, PointEntry.Type type, Long refId, String reason, Long by) {
        var e = new PointEntry();
        e.setKidId(kidId); e.setPoints(points); e.setType(type); e.setRefId(refId); e.setReason(reason); e.setCreatedBy(by);
        return entries.save(e);
    }
}
