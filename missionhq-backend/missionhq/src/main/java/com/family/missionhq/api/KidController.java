package com.family.missionhq.api;

import com.family.missionhq.celebration.Celebration;
import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.cosmetic.CosmeticService;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.PointEntryRepository;
import com.family.missionhq.mission.MissionService;
import com.family.missionhq.rank.RankService;
import com.family.missionhq.reward.Reward;
import com.family.missionhq.reward.RewardRepository;
import com.family.missionhq.reward.RewardService;
import com.family.missionhq.security.CurrentKid;
import com.family.missionhq.squad.SquadService;
import com.family.missionhq.push.PushRequested;
import org.springframework.context.ApplicationEventPublisher;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController @RequestMapping("/api/v1/me") @RequiredArgsConstructor
public class KidController {
    private final CurrentKid current;
    private final MissionService missions;
    private final RankService ranks;
    private final RewardService rewards;
    private final RewardRepository rewardRepo;
    private final CelebrationService celebrations;
    private final HouseholdRepository households;
    private final KidRepository kids;
    private final PointEntryRepository ledger;
    private final CosmeticService cosmetics;
    private final SquadService squad;
    private final ApplicationEventPublisher events;

    public record MeView(Long id, String callsign, String themeCode, int balance, int lifetimeEarned, int streakDays,
                         RankService.RankView rank, TermGoal termGoal, BigDecimal pointsPerCurrencyUnit, CosmeticService.AvatarView avatar) {}
    public record TermGoal(Long rewardId, String name, int target, int progress) {}

    @GetMapping
    public MeView me() {
        var kid = current.get();
        var hh = households.findById(kid.getHouseholdId()).orElseThrow();
        var goal = rewardRepo.findByKidIdAndTermGoalTrueAndStatus(kid.getId(), Reward.Status.ACTIVE)
                .map(r -> new TermGoal(r.getId(), r.getName(), r.getPrice(), Math.min(r.getPrice(), kid.getLifetimeEarned()))).orElse(null);
        return new MeView(kid.getId(), kid.getCallsign(), kid.getThemeCode(), kid.getBalance(), kid.getLifetimeEarned(),
                kid.getStreakDays(), ranks.view(kid), goal, hh.getPointsPerCurrencyUnit(), cosmetics.avatar(kid));
    }

    @GetMapping("/missions")
    public List<MissionService.MissionCard> missions(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return missions.cardsFor(current.get(), date != null ? date : LocalDate.now());
    }

    @PostMapping("/missions/{behaviourId}/photo-url")
    public com.family.missionhq.storage.PhotoStorage.UploadTicket photoUrl(@PathVariable Long behaviourId, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return missions.photoTicket(current.get(), behaviourId, date != null ? date : LocalDate.now());
    }

    public record SubmitRequest(LocalDate date, String photoKey) {}

    @PostMapping("/missions/{behaviourId}/submit")
    public Map<String, Object> submit(@PathVariable Long behaviourId, @RequestBody SubmitRequest body) {
        var c = missions.submit(current.get(), behaviourId, body.date() != null ? body.date() : LocalDate.now(), body.photoKey());
        return Map.of("completionId", c.getId(), "status", c.getStatus());
    }

    @GetMapping("/celebrations")
    public List<Celebration> celebrations() { return celebrations.unplayed(current.get().getId()); }

    @PostMapping("/celebrations/{id}/ack")
    public void ack(@PathVariable Long id) { celebrations.ack(current.get().getId(), id); }

    @GetMapping("/rewards")
    public List<Reward> rewards() { return rewards.catalogueFor(current.get()); }

    public record SuggestRequest(@NotBlank String name, Reward.Category category, BigDecimal estimatedCost) {}

    @PostMapping("/rewards/suggest")
    public Reward suggest(@Valid @RequestBody SuggestRequest body) {
        return rewards.suggest(current.get(), body.name(), body.category() != null ? body.category() : Reward.Category.OTHER, body.estimatedCost());
    }

    @PostMapping("/rewards/{id}/redeem")
    public Map<String, Object> redeem(@PathVariable Long id) {
        var red = rewards.redeem(current.get(), id);
        return Map.of("redemptionId", red.getId(), "pricePaid", red.getPricePaid());
    }

    @GetMapping("/avatar")
    public CosmeticService.AvatarView avatar() { return cosmetics.avatar(current.get()); }

    public record ColourRequest(int colour) {}
    @PutMapping("/avatar/colour")
    public CosmeticService.AvatarView colour(@RequestBody ColourRequest body) { return cosmetics.setColour(current.get(), body.colour()); }

    @GetMapping("/cosmetics")
    public List<CosmeticService.CatalogueItem> cosmetics() { return cosmetics.catalogue(current.get()); }

    @PostMapping("/cosmetics/{id}/buy")
    public CosmeticService.CatalogueItem buy(@PathVariable Long id) { return cosmetics.buy(current.get(), id); }

    @PostMapping("/cosmetics/{id}/equip")
    public CosmeticService.AvatarView equip(@PathVariable Long id) { return cosmetics.equip(current.get(), id); }

    public record ThemeRequest(String themeCode) {}
    @PutMapping("/theme")
    public MeView theme(@RequestBody ThemeRequest body) {
        var kid = current.get();
        if (!List.of("AIRSOFT", "HERO").contains(body.themeCode())) throw com.family.missionhq.common.DomainException.badRequest("unknown world");
        kid.setThemeCode(body.themeCode());
        kids.save(kid);
        return me();
    }

    public record SquadView(SquadService.Progress goal, int myContribution, List<Sibling> siblings) {}
    public record Sibling(Long id, String callsign, String rankName, String themeCode, CosmeticService.AvatarView avatar, int contributionPercent) {}

    /** Rank, avatar and share of the squad goal only. Never balances. */
    @GetMapping("/squad")
    public SquadView squad() {
        var kid = current.get();
        var goal = squad.progress(kid.getHouseholdId()).orElse(null);
        int total = Math.max(1, ledger.householdLifetime(kid.getHouseholdId()));
        var siblings = kids.findByHouseholdId(kid.getHouseholdId()).stream()
                .filter(s -> !s.getId().equals(kid.getId()))
                .map(s -> new Sibling(s.getId(), s.getCallsign(), ranks.view(s).name(), s.getThemeCode(), cosmetics.avatar(s), s.getLifetimeEarned() * 100 / total)).toList();
        return new SquadView(goal, kid.getLifetimeEarned() * 100 / total, siblings);
    }

    @PostMapping("/squad/high-five/{kidId}")
    @org.springframework.transaction.annotation.Transactional
    public void highFive(@PathVariable Long kidId) {
        var me = current.get();
        var sib = kids.findById(kidId).orElseThrow();
        if (!sib.getHouseholdId().equals(me.getHouseholdId())) throw com.family.missionhq.common.DomainException.forbidden("not in your squad");
        celebrations.highFive(sib, me.getCallsign());
        events.publishEvent(PushRequested.kid(sib.getId(), "High-five from " + me.getCallsign(), "Open the squad screen to send one back", "/squad"));
    }
}
