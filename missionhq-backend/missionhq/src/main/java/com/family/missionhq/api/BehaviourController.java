package com.family.missionhq.api;

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

/** Mission (behaviour) management for the parent app, scoped to the signed-in parent's household. */
@RestController @RequestMapping("/api/v1/behaviours") @RequiredArgsConstructor
public class BehaviourController {
    private final CurrentParent current;
    private final BehaviourService behaviours;

    public record BehaviourView(Long id, String title, int points, Behaviour.Kind kind, boolean requiresPhoto, LocalDate bonusDate, boolean active) {
        static BehaviourView of(Behaviour b) { return new BehaviourView(b.getId(), b.getTitle(), b.getPoints(), b.getKind(), b.isRequiresPhoto(), b.getBonusDate(), b.isActive()); }
    }

    public record BehaviourInput(@NotBlank @Size(max = 80) String title, @Positive int points, @NotNull Behaviour.Kind kind,
                                 boolean requiresPhoto, LocalDate bonusDate, boolean active) {
        BehaviourService.Input toInput() { return new BehaviourService.Input(title, points, kind, requiresPhoto, bonusDate, active); }
    }

    @GetMapping
    public List<BehaviourView> list() { return behaviours.forHousehold(current.get()).stream().map(BehaviourView::of).toList(); }

    @PostMapping
    public BehaviourView create(@Valid @RequestBody BehaviourInput body) { return BehaviourView.of(behaviours.create(current.get(), body.toInput())); }

    @PutMapping("/{id}")
    public BehaviourView update(@PathVariable Long id, @Valid @RequestBody BehaviourInput body) { return BehaviourView.of(behaviours.update(current.get(), id, body.toInput())); }
}
