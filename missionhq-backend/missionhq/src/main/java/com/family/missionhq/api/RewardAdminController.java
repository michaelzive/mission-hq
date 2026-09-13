package com.family.missionhq.api;

import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.reward.Redemption;
import com.family.missionhq.reward.Reward;
import com.family.missionhq.reward.RewardRepository;
import com.family.missionhq.reward.RewardService;
import com.family.missionhq.security.CurrentParent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/** Reward catalogue and open redemptions for the parent app, scoped to the signed-in parent's household. */
@RestController @RequestMapping("/api/v1") @RequiredArgsConstructor
public class RewardAdminController {
    private final CurrentParent current;
    private final RewardService rewards;
    private final RewardRepository rewardRepo;
    private final KidRepository kids;

    public record RewardView(Long id, Long kidId, String callsign, String name, Reward.Category category, Integer price, Integer tier,
                             Reward.Status status, boolean suggestedByKid, boolean termGoal, boolean repeatable) {}
    public record RewardInput(@NotNull Long kidId, @NotBlank @Size(max = 80) String name, Reward.Category category, @Positive int price,
                              boolean termGoal, boolean repeatable, boolean retired) {
        RewardService.Input toInput() { return new RewardService.Input(name, category, price, termGoal, repeatable, retired); }
    }
    public record OpenRedemption(Long id, Long kidId, String callsign, String rewardName, int pricePaid, Instant redeemedAt) {}

    @GetMapping("/rewards")
    public List<RewardView> list() { return rewards.forHousehold(current.get()).stream().map(this::view).toList(); }

    @PostMapping("/rewards")
    public RewardView create(@Valid @RequestBody RewardInput body) { return view(rewards.create(current.kid(body.kidId()), body.toInput())); }

    @PutMapping("/rewards/{id}")
    public RewardView update(@PathVariable Long id, @Valid @RequestBody RewardInput body) { return view(rewards.update(current.get(), id, body.toInput())); }

    @GetMapping("/redemptions")
    public List<OpenRedemption> openRedemptions() {
        return rewards.openRedemptions(current.get()).stream().map(this::view).toList();
    }

    private RewardView view(Reward r) {
        var k = kids.findById(r.getKidId()).orElseThrow();
        return new RewardView(r.getId(), k.getId(), k.getCallsign(), r.getName(), r.getCategory(), r.getPrice(), r.getTier(), r.getStatus(), r.isSuggestedByKid(), r.isTermGoal(), r.isRepeatable());
    }

    private OpenRedemption view(Redemption red) {
        var k = kids.findById(red.getKidId()).orElseThrow();
        var name = rewardRepo.findById(red.getRewardId()).map(Reward::getName).orElse("reward");
        return new OpenRedemption(red.getId(), k.getId(), k.getCallsign(), name, red.getPricePaid(), red.getRedeemedAt());
    }
}
