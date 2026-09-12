package com.family.missionhq.api;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.kid.DeviceService;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.LedgerService;
import com.family.missionhq.ledger.PointEntry;
import com.family.missionhq.mission.BehaviourRepository;
import com.family.missionhq.mission.MissionCompletion;
import com.family.missionhq.mission.MissionCompletionRepository;
import com.family.missionhq.mission.MissionService;
import com.family.missionhq.reward.Reward;
import com.family.missionhq.reward.RewardRepository;
import com.family.missionhq.reward.RewardService;
import com.family.missionhq.security.CurrentParent;
import com.family.missionhq.storage.PhotoStorage;
import com.family.missionhq.push.PushRequested;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Parent-side endpoints. Everything is scoped to the signed-in parent's household. */
@RestController @RequestMapping("/api/v1") @RequiredArgsConstructor
public class ApprovalController {
    private final CurrentParent current;
    private final MissionService missions;
    private final MissionCompletionRepository completions;
    private final BehaviourRepository behaviours;
    private final RewardService rewards;
    private final RewardRepository rewardRepo;
    private final KidRepository kids;
    private final LedgerService ledger;
    private final CelebrationService celebrations;
    private final HouseholdRepository households;
    private final DeviceService devices;
    private final PhotoStorage photos;
    private final ApplicationEventPublisher events;

    public record PendingMission(Long completionId, Long kidId, String callsign, String title, int points, String photoKey, String photoUrl, java.time.Instant submittedAt) {}
    public record PendingReward(Long rewardId, Long kidId, String callsign, String name, Reward.Category category, BigDecimal estimatedCost, int suggestedPrice) {}
    public record Queue(List<PendingMission> missions, List<PendingReward> rewards) {}

    @GetMapping("/approvals")
    public Queue queue() {
        var householdId = current.get().getHouseholdId();
        var m = completions.findByHouseholdIdAndStatusOrderBySubmittedAtAsc(householdId, MissionCompletion.Status.PENDING).stream().map(c -> {
            var b = behaviours.findById(c.getBehaviourId()).orElseThrow();
            var k = kids.findById(c.getKidId()).orElseThrow();
            var url = c.getPhotoKey() == null ? null : photos.presignView(c.getPhotoKey(), java.time.Duration.ofMinutes(30));
            return new PendingMission(c.getId(), k.getId(), k.getCallsign(), b.getTitle(), b.getPoints(), c.getPhotoKey(), url, c.getSubmittedAt());
        }).toList();
        var r = rewardRepo.findByHouseholdIdAndStatusOrderByIdAsc(householdId, Reward.Status.PENDING).stream().map(x -> {
            var k = kids.findById(x.getKidId()).orElseThrow();
            return new PendingReward(x.getId(), k.getId(), k.getCallsign(), x.getName(), x.getCategory(), x.getEstimatedCost(), rewards.suggestedPrice(x));
        }).toList();
        return new Queue(m, r);
    }

    public record ApproveMission(Integer bonusPoints) {}
    @PostMapping("/approvals/missions/{id}/approve")
    public void approveMission(@PathVariable Long id, @RequestBody(required = false) ApproveMission body) {
        missions.approve(id, current.get(), body != null && body.bonusPoints() != null ? body.bonusPoints() : 0);
    }

    public record SendBack(String note) {}
    @PostMapping("/approvals/missions/{id}/send-back")
    public void sendBack(@PathVariable Long id, @RequestBody(required = false) SendBack body) {
        missions.sendBack(id, current.get(), body != null ? body.note() : null);
    }

    public record ApproveReward(Integer price, Integer tier) {}
    @PostMapping("/approvals/rewards/{id}/approve")
    public Reward approveReward(@PathVariable Long id, @RequestBody(required = false) ApproveReward body) {
        return rewards.approve(id, current.get(), body != null ? body.price() : null, body != null ? body.tier() : null);
    }

    @PostMapping("/approvals/rewards/{id}/decline")
    public void declineReward(@PathVariable Long id) { rewards.decline(id, current.get()); }

    public record Bonus(int points, String reason) {}
    @PostMapping("/kids/{id}/bonus")
    @org.springframework.transaction.annotation.Transactional
    public void bonus(@PathVariable Long id, @RequestBody Bonus body) {
        var parent = current.get();
        var kid = current.kid(id);
        ledger.award(kid, body.points(), PointEntry.Type.BONUS, null, body.reason(), parent.getId());
        celebrations.bonus(kid, body.points(), body.reason());
        events.publishEvent(PushRequested.kid(kid.getId(), "Surprise from HQ", "+" + body.points() + " · " + body.reason(), "/hq"));
    }

    public record Reprice(int price) {}
    @PutMapping("/kids/{kidId}/rewards/{rewardId}/price")
    public void reprice(@PathVariable Long kidId, @PathVariable Long rewardId, @RequestBody Reprice body) { rewards.reprice(rewardId, current.get(), body.price()); }

    public record Rate(BigDecimal pointsPerCurrencyUnit) {}
    @PutMapping("/household/exchange-rate")
    public void rate(@RequestBody Rate body) {
        var hh = households.findById(current.get().getHouseholdId()).orElseThrow();
        hh.setPointsPerCurrencyUnit(body.pointsPerCurrencyUnit());
        households.save(hh);
    }

    @PostMapping("/kids/{id}/pairing-code")
    public Map<String, String> pairingCode(@PathVariable Long id) { return Map.of("pairingCode", devices.createPairingCode(current.kid(id).getId())); }

    @PostMapping("/redemptions/{id}/fulfil")
    public void fulfil(@PathVariable Long id) { rewards.fulfil(id, current.get()); }
}
