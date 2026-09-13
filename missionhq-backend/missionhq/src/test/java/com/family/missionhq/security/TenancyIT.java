package com.family.missionhq.security;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.Household;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.household.Parent;
import com.family.missionhq.household.ParentRepository;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.kid.KidService;
import com.family.missionhq.mission.Behaviour;
import com.family.missionhq.mission.BehaviourService;
import com.family.missionhq.mission.MissionCompletion;
import com.family.missionhq.mission.MissionCompletionRepository;
import com.family.missionhq.mission.MissionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A parent in one household can neither see nor act on another household's kids. Requires Docker. */
@SpringBootTest @Testcontainers @ActiveProfiles("dev")
class TenancyIT {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MissionService missions;
    @Autowired MissionCompletionRepository completions;
    @Autowired KidRepository kids;
    @Autowired KidService kidService;
    @Autowired BehaviourService behaviourService;
    @Autowired ParentRepository parents;
    @Autowired HouseholdRepository households;
    @Autowired PasswordEncoder encoder;

    @Test void otherHouseholdsPendingWorkIsInvisibleAndUntouchable() {
        var viper = kids.findById(1L).orElseThrow();                               // household 1, V2 seed
        var completion = missions.submit(viper, 1L, LocalDate.now(), "photo");
        var stranger = strangerParent();

        assertThat(completions.findByHouseholdIdAndStatusOrderBySubmittedAtAsc(stranger.getHouseholdId(), MissionCompletion.Status.PENDING)).isEmpty();
        assertThat(completions.findByHouseholdIdAndStatusOrderBySubmittedAtAsc(1L, MissionCompletion.Status.PENDING)).extracting(MissionCompletion::getId).contains(completion.getId());

        assertThatThrownBy(() -> missions.approve(completion.getId(), stranger, 0))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(completions.findById(completion.getId()).orElseThrow().getStatus()).isEqualTo(MissionCompletion.Status.PENDING);
    }

    @Test void createdKidsLandInTheParentsHouseholdAndWorldsAreValidated() {
        var stranger = strangerParent();
        var kid = kidService.create(stranger.getHouseholdId(), "  Rookie ", "HERO");

        assertThat(kid.getCallsign()).isEqualTo("Rookie");
        assertThat(kids.findByHouseholdId(stranger.getHouseholdId())).extracting(Kid::getId).containsExactly(kid.getId());
        assertThat(kids.findByHouseholdId(1L)).extracting(Kid::getId).doesNotContain(kid.getId());
        assertThatThrownBy(() -> kidService.update(kid, "Rookie", "NARNIA"))
                .isInstanceOf(DomainException.class).hasMessageContaining("unknown world");
    }

    @Test void missionsAreScopedToTheParentsHousehold() {
        var stranger = strangerParent();
        var home = parents.findByEmail("dad@example.com").orElseThrow();
        var input = new BehaviourService.Input(" Feed the dog ", 10, Behaviour.Kind.DAILY, false, null, true);
        var b = behaviourService.create(stranger, input);

        assertThat(b.getTitle()).isEqualTo("Feed the dog");
        assertThat(behaviourService.forHousehold(stranger)).extracting(Behaviour::getId).containsExactly(b.getId());
        assertThat(behaviourService.forHousehold(home)).extracting(Behaviour::getId).doesNotContain(b.getId());
        assertThatThrownBy(() -> behaviourService.update(home, b.getId(), input))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
        assertThatThrownBy(() -> behaviourService.create(stranger, new BehaviourService.Input("Test", 30, Behaviour.Kind.BONUS, true, null, true)))
                .isInstanceOf(DomainException.class).hasMessageContaining("needs a date");
    }

    @Test void bootstrapSyncsTheConfiguredParentPassword() {
        var dev = parents.findByEmail("dad@example.com").orElseThrow();            // V3 seed, placeholder hash
        assertThat(encoder.matches("change-me", dev.getPasswordHash())).isTrue();  // application.yml default
        assertThat(dev.getHouseholdId()).isEqualTo(1L);
    }

    private Parent strangerParent() {
        var hh = new Household(); hh.setName("Next door"); households.save(hh);
        var p = new Parent(); p.setHouseholdId(hh.getId()); p.setName("Neighbour"); p.setEmail("neighbour-" + hh.getId() + "@example.com"); p.setPasswordHash("x");
        return parents.save(p);
    }
}
