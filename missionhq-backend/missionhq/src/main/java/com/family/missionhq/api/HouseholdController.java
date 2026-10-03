package com.family.missionhq.api;

import com.family.missionhq.household.Household;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.kid.KidService;
import com.family.missionhq.mission.StreakService;
import com.family.missionhq.common.DomainException;
import com.family.missionhq.rank.RankService;
import com.family.missionhq.security.CurrentParent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.DateTimeException;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

/** Household and kid management for the parent app. Everything is scoped to the signed-in parent's household. */
@RestController @RequestMapping("/api/v1") @RequiredArgsConstructor
public class HouseholdController {
    private final CurrentParent current;
    private final HouseholdRepository households;
    private final KidRepository kids;
    private final KidService kidService;
    private final RankService ranks;
    private final StreakService streaks;

    @GetMapping("/household")
    public Household household() { return households.findById(current.get().getHouseholdId()).orElseThrow(); }

    /** reminderTime null = no evening reminder. */
    public record Settings(@NotBlank String timezone, LocalTime reminderTime, @Min(1) @Max(100) int parentLogPercent) {}

    @PutMapping("/household/settings")
    public Household settings(@Valid @RequestBody Settings body) {
        try { ZoneId.of(body.timezone()); } catch (DateTimeException e) { throw DomainException.badRequest("unknown time zone"); }
        var hh = households.findById(current.get().getHouseholdId()).orElseThrow();
        hh.setTimezone(body.timezone());
        hh.setReminderTime(body.reminderTime());
        hh.setParentLogPercent(body.parentLogPercent());
        return households.save(hh);
    }

    public record KidSummary(Long id, String callsign, String themeCode, int balance, int lifetimeEarned, int streakDays, String rankName) {}

    @GetMapping("/kids")
    public List<KidSummary> kids() {
        return kids.findByHouseholdId(current.get().getHouseholdId()).stream().map(this::summary).toList();
    }

    public record KidInput(@NotBlank @Size(max = 20) String callsign, @NotBlank String themeCode) {}

    @PostMapping("/kids")
    public KidSummary createKid(@Valid @RequestBody KidInput body) {
        return summary(kidService.create(current.get().getHouseholdId(), body.callsign(), body.themeCode()));
    }

    @PutMapping("/kids/{id}")
    public KidSummary updateKid(@PathVariable Long id, @Valid @RequestBody KidInput body) {
        return summary(kidService.update(current.kid(id), body.callsign(), body.themeCode()));
    }

    private KidSummary summary(Kid k) {
        return new KidSummary(k.getId(), k.getCallsign(), k.getThemeCode(), k.getBalance(), k.getLifetimeEarned(), streaks.current(k).days(), ranks.view(k).name());
    }
}
