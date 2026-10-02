package com.family.missionhq.api;

import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.mission.Behaviour;
import com.family.missionhq.mission.BehaviourService;
import com.family.missionhq.security.CurrentParent;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Mission (behaviour) management for the parent app, scoped to the signed-in parent's household. */
@RestController @RequestMapping("/api/v1/behaviours") @RequiredArgsConstructor
public class BehaviourController {
    private final CurrentParent current;
    private final BehaviourService behaviours;
    private final KidRepository kids;

    /** kidId/callsign are null for a mission every kid sees. */
    public record BehaviourView(Long id, Long kidId, String callsign, String title, int points, Behaviour.Kind kind, boolean requiresPhoto, LocalDate bonusDate, boolean active) {
        static BehaviourView of(Behaviour b, Map<Long, String> callsigns) {
            return new BehaviourView(b.getId(), b.getKidId(), callsigns.get(b.getKidId()), b.getTitle(), b.getPoints(), b.getKind(), b.isRequiresPhoto(), b.getBonusDate(), b.isActive());
        }
    }

    /** kidId null = every kid in the household. */
    public record BehaviourInput(Long kidId, @NotBlank @Size(max = 80) String title, @Positive int points, @NotNull Behaviour.Kind kind,
                                 boolean requiresPhoto, LocalDate bonusDate, boolean active) {
        BehaviourService.Input toInput() { return new BehaviourService.Input(title, points, kind, requiresPhoto, bonusDate, active); }
    }

    @GetMapping
    public List<BehaviourView> list() {
        var parent = current.get();
        var callsigns = callsigns(parent.getHouseholdId());
        return behaviours.forHousehold(parent).stream().map(b -> BehaviourView.of(b, callsigns)).toList();
    }

    @PostMapping
    public BehaviourView create(@Valid @RequestBody BehaviourInput body) {
        var parent = current.get();
        return BehaviourView.of(behaviours.create(parent, kid(body), body.toInput()), callsigns(parent.getHouseholdId()));
    }

    @PutMapping("/{id}")
    public BehaviourView update(@PathVariable Long id, @Valid @RequestBody BehaviourInput body) {
        var parent = current.get();
        return BehaviourView.of(behaviours.update(parent, id, kid(body), body.toInput()), callsigns(parent.getHouseholdId()));
    }

    private Kid kid(BehaviourInput body) { return body.kidId() == null ? null : current.kid(body.kidId()); }

    private Map<Long, String> callsigns(Long householdId) {
        return kids.findByHouseholdId(householdId).stream().collect(Collectors.toMap(Kid::getId, Kid::getCallsign));
    }
}
