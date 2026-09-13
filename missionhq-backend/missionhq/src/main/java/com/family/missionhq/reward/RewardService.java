package com.family.missionhq.reward;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.household.Parent;
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
        return rewards.findCatalogue(kid.getId(), kid.getHouseholdId(), List.of(Reward.Status.ACTIVE, Reward.Status.PENDING));
    }

    @Transactional
    public Reward suggest(Kid kid, String name, Reward.Category category, BigDecimal estimatedCost) {
        if (rewards.countByKidIdAndStatus(kid.getId(), Reward.Status.PENDING) >= MAX_PENDING_SUGGESTIONS)
            throw DomainException.conflict("you already have " + MAX_PENDING_SUGGESTIONS + " suggestions waiting");
        var r = new Reward();
        r.setKidId(kid.getId()); r.setName(name); r.setCategory(category); r.setEstimatedCost(estimatedCost);
        r.setSuggestedByKid(true); r.setStatus(Reward.Status.PENDING);
        var saved = rewards.save(r);
        events.publishEvent(PushRequested.parents(kid.getHouseholdId(), kid.getCallsign() + " suggested a reward", name, "/approvals"));
        return saved;
    }

    /** Price the parent sees pre-filled, derived from the household rate at this moment. */
    @Transactional(readOnly = true)
    public int suggestedPrice(Reward r) {
        var hh = households.findById(householdOf(r)).orElseThrow();
        return hh.suggestedPrice(r.getEstimatedCost());
    }

    @Transactional
    public Reward approve(Long rewardId, Parent parent, Integer price, Integer tier) {
        var r = ownedBy(parent, rewardId);
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
    public void decline(Long rewardId, Parent parent) {
        var r = ownedBy(parent, rewardId);
        r.setStatus(Reward.Status.DECLINED);
    }

    /** Prices only ever go down after approval. */
    @Transactional
    public void reprice(Long rewardId, Parent parent, int newPrice) {
        var r = ownedBy(parent, rewardId);
        if (r.getPrice() != null && newPrice > r.getPrice()) throw DomainException.badRequest("a price can only be lowered after approval");
        if (newPrice <= 0) throw DomainException.badRequest("price must be positive");
        r.setPrice(newPrice); r.setManualPrice(true);
    }

    @Transactional
    public Redemption redeem(Kid kid, Long rewardId) {
        var r = rewards.findById(rewardId).orElseThrow(() -> DomainException.notFound("reward"));
        if (!r.isFor(kid)) throw DomainException.forbidden("not your reward");
        if (r.getStatus() != Reward.Status.ACTIVE) throw DomainException.conflict("reward not available");
        // a one-off shared reward is once per kid, not once for whoever taps first
        if (r.isShared() && !r.isRepeatable() && redemptions.existsByKidIdAndRewardId(kid.getId(), r.getId())) throw DomainException.conflict("you already redeemed that one");
        var red = new Redemption();
        red.setKidId(kid.getId()); red.setRewardId(r.getId()); red.setPricePaid(r.getPrice());
        redemptions.save(red);
        ledger.spend(kid, r.getPrice(), red.getId());
        celebrations.redeemed(kid, red.getId(), r.getTier(), r.getName());
        if (!r.isRepeatable() && !r.isShared()) r.setStatus(Reward.Status.RETIRED);
        events.publishEvent(PushRequested.parents(kid.getHouseholdId(), kid.getCallsign() + " redeemed " + r.getName(), r.getPrice() + " pts. Time to make it happen.", "/approvals"));
        return red;
    }

    @Transactional
    public void fulfil(Long redemptionId, Parent parent) {
        var red = redemptions.findById(redemptionId)
                .filter(x -> inHousehold(parent, x.getKidId()))
                .orElseThrow(() -> DomainException.notFound("redemption"));
        red.setFulfilledAt(Instant.now()); red.setFulfilledBy(parent.getId());
    }

    // ---- parent-side management ----

    public record Input(String name, Reward.Category category, int price, boolean termGoal, boolean repeatable, boolean retired) {}

    @Transactional(readOnly = true)
    public List<Reward> forHousehold(Parent parent) {
        return rewards.findByHouseholdIdAndStatusIn(parent.getHouseholdId(), List.of(Reward.Status.ACTIVE, Reward.Status.PENDING, Reward.Status.RETIRED));
    }

    @Transactional(readOnly = true)
    public List<Redemption> openRedemptions(Parent parent) { return redemptions.findOpenByHouseholdId(parent.getHouseholdId()); }

    /** Parent-created rewards go straight into the shop, priced by the parent. kid == null means everyone's shop. */
    @Transactional
    public Reward create(Parent parent, Kid kid, Input in) {
        var r = new Reward();
        if (kid != null) r.setKidId(kid.getId()); else r.setHouseholdId(parent.getHouseholdId());
        r.setSuggestedByKid(false); r.setManualPrice(true);
        r.setStatus(in.retired() ? Reward.Status.RETIRED : Reward.Status.ACTIVE);
        apply(r, in);
        var saved = rewards.save(r);
        if (saved.isTermGoal() && saved.getStatus() == Reward.Status.ACTIVE) makeSoleTermGoal(saved);
        return saved;
    }

    @Transactional
    public Reward update(Parent parent, Long rewardId, Input in) {
        var r = ownedBy(parent, rewardId);
        if (r.getStatus() == Reward.Status.PENDING || r.getStatus() == Reward.Status.DECLINED) throw DomainException.conflict("suggestions are handled in Approvals");
        if (r.getPrice() != null && in.price() > r.getPrice()) throw DomainException.badRequest("a price can only be lowered after approval");
        r.setStatus(in.retired() ? Reward.Status.RETIRED : Reward.Status.ACTIVE);
        apply(r, in);
        if (r.isTermGoal() && r.getStatus() == Reward.Status.ACTIVE) makeSoleTermGoal(r);
        return r;
    }

    private void apply(Reward r, Input in) {
        var name = in.name() == null ? "" : in.name().trim();
        if (name.isEmpty() || name.length() > 80) throw DomainException.badRequest("name must be 1-80 characters");
        if (in.price() <= 0) throw DomainException.badRequest("price must be positive");
        if (in.termGoal() && r.isShared()) throw DomainException.badRequest("a term goal belongs to one kid");
        r.setName(name);
        r.setCategory(in.category() != null ? in.category() : Reward.Category.OTHER);
        r.setPrice(in.price());
        r.setTier(Reward.tierFor(in.price()));
        r.setTermGoal(in.termGoal());
        r.setRepeatable(in.repeatable());
    }

    /** HQ shows one term goal per kid, so setting a new one clears the old. */
    private void makeSoleTermGoal(Reward goal) {
        rewards.findByKidIdAndStatusIn(goal.getKidId(), List.of(Reward.Status.ACTIVE)).stream()
                .filter(o -> o.isTermGoal() && !o.getId().equals(goal.getId()))
                .forEach(o -> o.setTermGoal(false));
    }

    /** A reward in another household reads as not found so ids never leak across families. */
    private Reward ownedBy(Parent parent, Long rewardId) {
        return rewards.findById(rewardId).filter(r -> householdOf(r).equals(parent.getHouseholdId()))
                .orElseThrow(() -> DomainException.notFound("reward"));
    }

    private Long householdOf(Reward r) {
        return r.isShared() ? r.getHouseholdId() : kids.findById(r.getKidId()).map(Kid::getHouseholdId).orElse(-1L);
    }

    private boolean inHousehold(Parent parent, Long kidId) {
        return kids.findById(kidId).map(k -> k.getHouseholdId().equals(parent.getHouseholdId())).orElse(false);
    }
}
