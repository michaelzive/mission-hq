package com.family.missionhq.mission;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.Parent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/** Parent-side management of a household's missions (behaviours). */
@Service @RequiredArgsConstructor
public class BehaviourService {
    private final BehaviourRepository behaviours;

    public record Input(String title, int points, Behaviour.Kind kind, boolean requiresPhoto, LocalDate bonusDate, boolean active) {}

    @Transactional(readOnly = true)
    public List<Behaviour> forHousehold(Parent parent) {
        return behaviours.findByHouseholdIdOrderByActiveDescIdAsc(parent.getHouseholdId());
    }

    @Transactional
    public Behaviour create(Parent parent, Input in) {
        var b = new Behaviour();
        b.setHouseholdId(parent.getHouseholdId());
        apply(b, in);
        return behaviours.save(b);
    }

    @Transactional
    public Behaviour update(Parent parent, Long id, Input in) {
        var b = behaviours.findById(id).filter(x -> x.getHouseholdId().equals(parent.getHouseholdId()))
                .orElseThrow(() -> DomainException.notFound("mission"));
        apply(b, in);
        return behaviours.save(b);
    }

    private void apply(Behaviour b, Input in) {
        var title = in.title() == null ? "" : in.title().trim();
        if (title.isEmpty() || title.length() > 80) throw DomainException.badRequest("title must be 1-80 characters");
        if (in.points() <= 0) throw DomainException.badRequest("points must be positive");
        if (in.kind() == null) throw DomainException.badRequest("kind is required");
        if (in.kind() == Behaviour.Kind.BONUS && in.bonusDate() == null) throw DomainException.badRequest("a bonus mission needs a date");
        b.setTitle(title);
        b.setPoints(in.points());
        b.setKind(in.kind());
        b.setRequiresPhoto(in.requiresPhoto());
        b.setBonusDate(in.kind() == Behaviour.Kind.BONUS ? in.bonusDate() : null);
        b.setActive(in.active());
    }
}
