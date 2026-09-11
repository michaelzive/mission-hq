package com.family.missionhq.reward;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.LedgerService;
import com.family.missionhq.push.PushRequested;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service @RequiredArgsConstructor
public class RewardService {
    static final int MAX_PENDING_SUGGESTIONS = 3;

    private final RewardRepository rewards;
    private final RedemptionRepository redemptions;
    private final HouseholdRepository households;
    private final KidRepository kids;
    private final LedgerService ledger;
    private final CelebrationService celebrations;
    private final ApplicationEventPublisher events;

    @Transactional(readOnly = true)
    public List<Reward> catalogueFor(Kid kid) {
        return rewards.findByKidIdAndStatusIn(kid.getId(), List.of(Reward.Status.ACTIVE, Reward.Status.PENDING));
    }

    @Transactional
    public Reward suggest(Kid kid, String name, Reward.Category category, BigDecimal estimatedCost) {
        if (rewards.countByKidIdAndStatus(kid.getId(), Reward.Status.PENDING) >= MAX_PENDING_SUGGESTIONS)
            throw DomainException.conflict("you already have " + MAX_PENDING_SUGGESTIONS + " suggestions waiting");
        var r = new Reward();
        r.setKidId(kid.getId()); r.setName(name); r.setCategory(category); r.setEstimatedCost(estimatedCost);
        r.setSuggestedByKid(true); r.setStatus(Reward.Status.PENDING);
        var saved = rewards.save(r);
        events.publishEvent(PushRequested.parents(kid.getCallsign() + " suggested a reward", name, "/approvals"));
        return saved;
    }

    /** Price the parent sees pre-filled, derived from the household rate at this moment. */
    @Transactional(readOnly = true)
    public int suggestedPrice(Reward r) {
        var kid = kids.findById(r.getKidId()).orElseThrow();
        var hh = households.findById(kid.getHouseholdId()).orElseThrow();
        return hh.suggestedPrice(r.getEstimatedCost());
    }

    @Transactional
    public Reward approve(Long rewardId, Integer price, Integer tier) {
        var r = rewards.findById(rewardId).orElseThrow(() -> DomainException.notFound("reward"));
        if (r.getStatus() != Reward.Status.PENDING) throw DomainException.conflict("not pending");
        int suggested = suggestedPrice(r);
        int finalPrice = price != null ? price : suggested;
        if (finalPrice <= 0) throw DomainException.badRequest("price must be positive");
        r.setPrice(finalPrice);
        r.setManualPrice(price != null && price != suggested);
        r.setTier(tier != null ? tier : Reward.tierFor(finalPrice));
        r.setStatus(Reward.Status.ACTIVE);
        events.publishEvent(PushRequested.kid(r.getKidId(), "Your suggestion is in the shop", r.getName() + " · " + finalPrice + " pts", "/shop"));
        return r;
    }

    @Transactional
    public void decline(Long rewardId) {
        var r = rewards.findById(rewardId).orElseThrow(() -> DomainException.notFound("reward"));
        r.setStatus(Reward.Status.DECLINED);
    }

    /** Prices only ever go down after approval. */
    @Transactional
    public void reprice(Long rewardId, int newPrice) {
        var r = rewards.findById(rewardId).orElseThrow(() -> DomainException.notFound("reward"));
        if (r.getPrice() != null && newPrice > r.getPrice()) throw DomainException.badRequest("a price can only be lowered after approval");
        if (newPrice <= 0) throw DomainException.badRequest("price must be positive");
        r.setPrice(newPrice); r.setManualPrice(true);
    }

    @Transactional
    public Redemption redeem(Kid kid, Long rewardId) {
        var r = rewards.findById(rewardId).orElseThrow(() -> DomainException.notFound("reward"));
        if (!r.getKidId().equals(kid.getId())) throw DomainException.forbidden("not your reward");
        if (r.getStatus() != Reward.Status.ACTIVE) throw DomainException.conflict("reward not available");
        var red = new Redemption();
        red.setKidId(kid.getId()); red.setRewardId(r.getId()); red.setPricePaid(r.getPrice());
        redemptions.save(red);
        ledger.spend(kid, r.getPrice(), red.getId());
        celebrations.redeemed(kid, red.getId(), r.getTier(), r.getName());
        if (!r.isRepeatable()) r.setStatus(Reward.Status.RETIRED);
        events.publishEvent(PushRequested.parents(kid.getCallsign() + " redeemed " + r.getName(), r.getPrice() + " pts. Time to make it happen.", "/approvals"));
        return red;
    }

    @Transactional
    public void fulfil(Long redemptionId, Long parentId) {
        var red = redemptions.findById(redemptionId).orElseThrow(() -> DomainException.notFound("redemption"));
        red.setFulfilledAt(Instant.now()); red.setFulfilledBy(parentId);
    }
}
