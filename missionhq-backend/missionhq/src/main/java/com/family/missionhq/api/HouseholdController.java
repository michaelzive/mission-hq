package com.family.missionhq.api;

import com.family.missionhq.household.Household;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.rank.RankService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Read endpoints the parent app needs alongside the approval queue. Single household (id 1) in this cut. */
@RestController @RequestMapping("/api/v1") @RequiredArgsConstructor
public class HouseholdController {
    private final HouseholdRepository households;
    private final KidRepository kids;
    private final RankService ranks;

    @GetMapping("/household")
    public Household household() { return households.findById(1L).orElseThrow(); }

    public record KidSummary(Long id, String callsign, String themeCode, int balance, int lifetimeEarned, int streakDays, String rankName) {}

    @GetMapping("/kids")
    public List<KidSummary> kids() {
        return kids.findByHouseholdId(1L).stream()
                .map(k -> new KidSummary(k.getId(), k.getCallsign(), k.getThemeCode(), k.getBalance(), k.getLifetimeEarned(), k.getStreakDays(), ranks.view(k).name()))
                .toList();
    }
}
