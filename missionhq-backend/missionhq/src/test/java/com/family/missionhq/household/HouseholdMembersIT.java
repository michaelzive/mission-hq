package com.family.missionhq.household;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.security.FirebaseParents;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Invites into a household, family invites from admins, and removing parents. Requires Docker. */
@SpringBootTest(properties = "missionhq.admin-emails=boss@example.com other-admin@example.com") @Testcontainers @ActiveProfiles("dev")
class HouseholdMembersIT {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired HouseholdMembers members;
    @Autowired ParentRepository parents;
    @Autowired ParentInviteRepository invites;
    @Autowired HouseholdRepository households;
    @Autowired FirebaseParents firebase;

    @Test void anInviteLinkAddsOneParentToTheInvitersHouseholdAndThenIsSpent() {
        var mike = parent("Mike", "mike@example.com");
        var created = members.invite(mike);

        assertThat(created.invite().getExpiresAt()).isAfter(Instant.now().plus(HouseholdMembers.INVITE_LIFETIME).minusSeconds(60));
        assertThat(created.invite().getTokenHash()).isNotEqualTo(created.token()).hasSize(64);
        assertThat(members.preview(created.token())).isEqualTo(new HouseholdMembers.InvitePreview("Mike", HouseholdMembers.InviteStatus.OPEN, ParentInvite.Kind.PARENT));
        assertThat(members.openInvites(mike)).extracting(ParentInvite::getId).containsExactly(created.invite().getId());

        var sam = members.accept(created.token(), "uid-sam", "sam@example.com", true, "  Sam ");
        assertThat(sam.getHouseholdId()).isEqualTo(mike.getHouseholdId());
        assertThat(sam.getName()).isEqualTo("Sam");
        assertThat(members.parentsOf(mike)).extracting(Parent::getName).containsExactly("Mike", "Sam");
        assertThat(firebase.convert(token("uid-sam", "sam@example.com")).getAuthorities()).extracting("authority").containsExactly("ROLE_PARENT");
        assertThat(members.preview(created.token()).status()).isEqualTo(HouseholdMembers.InviteStatus.USED);
        assertThat(members.openInvites(mike)).isEmpty();

        assertThatThrownBy(() -> members.accept(created.token(), "uid-other", "other@example.com", true, "Other"))
                .isInstanceOf(DomainException.class).hasMessageContaining("already been used");
    }

    @Test void acceptingNeedsAVerifiedEmailNoHouseholdAndALiveInvite() {
        var mike = parent("Mike", "mike2@example.com");

        var live = members.invite(mike).token();
        assertThatThrownBy(() -> members.accept(live, "uid-x", "x@example.com", false, "X"))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        assertThatThrownBy(() -> members.accept(live, "uid-mike2", "mike2@example.com", true, "Mike again"))
                .isInstanceOf(DomainException.class).hasMessageContaining("already part of a family");

        var expired = members.invite(mike);
        expired.invite().setExpiresAt(Instant.now().minusSeconds(1)); invites.save(expired.invite());
        assertThatThrownBy(() -> members.accept(expired.token(), "uid-y", "y@example.com", true, "Y"))
                .isInstanceOf(DomainException.class).hasMessageContaining("expired");

        var cancelled = members.invite(mike);
        members.cancel(mike, cancelled.invite().getId());
        assertThatThrownBy(() -> members.accept(cancelled.token(), "uid-y", "y@example.com", true, "Y"))
                .isInstanceOf(DomainException.class).hasMessageContaining("cancelled");

        assertThatThrownBy(() -> members.preview("not-a-real-token"))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test void anotherHouseholdCannotSeeOrCancelYourInvites() {
        var mike = parent("Mike", "mike3@example.com");
        var stranger = parent("Neighbour", "neighbour@example.com");
        var created = members.invite(mike);

        assertThat(members.openInvites(stranger)).isEmpty();
        assertThatThrownBy(() -> members.cancel(stranger, created.invite().getId()))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
        assertThatThrownBy(() -> members.remove(stranger, mike.getId()))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test void aRemovedParentLosesAccessKeepsTheirRowAndCanBeInvitedAgain() {
        var mike = parent("Mike", "mike4@example.com");
        var sam = members.accept(members.invite(mike).token(), "uid-sam4", "sam4@example.com", true, "Sam");

        assertThatThrownBy(() -> members.remove(mike, mike.getId()))
                .isInstanceOf(DomainException.class).hasMessageContaining("yourself");

        members.remove(mike, sam.getId());
        var row = parents.findById(sam.getId()).orElseThrow();
        assertThat(row.getRemovedAt()).isNotNull();
        assertThat(row.getEmail()).isNull();
        assertThat(row.getName()).isEqualTo("Sam");
        assertThat(members.parentsOf(mike)).extracting(Parent::getName).containsExactly("Mike");
        assertThat(firebase.convert(token("uid-sam4", "sam4@example.com")).getPrincipal()).isInstanceOf(FirebaseParents.SignedInVisitor.class);

        var back = members.accept(members.invite(mike).token(), "uid-sam4", "sam4@example.com", true, "Sam");
        assertThat(back.getId()).isNotEqualTo(sam.getId());
        assertThat(members.parentsOf(mike)).extracting(Parent::getName).containsExactly("Mike", "Sam");
    }

    @Test void onlyAdminsInviteFamiliesAndAcceptingOneStartsANewHousehold() {
        var mike = parent("Mike", "mike5@example.com");
        assertThatThrownBy(() -> members.inviteFamily(mike))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
        assertThatThrownBy(() -> members.openFamilyInvites(mike))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.FORBIDDEN);

        var boss = parent("Boss", "Boss@Example.com");
        var created = members.inviteFamily(boss);
        assertThat(created.invite().getHouseholdId()).isNull();
        assertThat(members.preview(created.token())).isEqualTo(new HouseholdMembers.InvitePreview("Boss", HouseholdMembers.InviteStatus.OPEN, ParentInvite.Kind.FAMILY));
        assertThat(members.openFamilyInvites(boss)).extracting(ParentInvite::getId).containsExactly(created.invite().getId());
        assertThat(members.openInvites(boss)).isEmpty();

        var jo = members.accept(created.token(), "uid-jo", "jo@example.com", true, "Jo");
        assertThat(jo.getHouseholdId()).isNotEqualTo(boss.getHouseholdId());
        assertThat(households.findById(jo.getHouseholdId()).orElseThrow().getName()).isEqualTo("Jo's family");
        assertThat(members.parentsOf(jo)).extracting(Parent::getName).containsExactly("Jo");
        assertThat(members.parentsOf(boss)).extracting(Parent::getName).containsExactly("Boss");
        assertThat(members.isAdmin(jo)).isFalse();
        assertThat(members.openFamilyInvites(boss)).isEmpty();

        // Jo's household can grow the normal way
        var sam = members.accept(members.invite(jo).token(), "uid-sam6", "sam6@example.com", true, "Sam");
        assertThat(sam.getHouseholdId()).isEqualTo(jo.getHouseholdId());
    }

    @Test void aFamilyInviteCanOnlyBeCancelledByTheAdminWhoMadeIt() {
        var boss = parent("Boss", "other-admin@example.com");
        var neighbour = parent("Neighbour", "neighbour7@example.com");
        var created = members.inviteFamily(boss);

        assertThatThrownBy(() -> members.cancel(neighbour, created.invite().getId()))
                .isInstanceOf(DomainException.class).extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
        members.cancel(boss, created.invite().getId());
        assertThat(members.preview(created.token()).status()).isEqualTo(HouseholdMembers.InviteStatus.CANCELLED);
    }

    private Parent parent(String name, String email) {
        var hh = new Household(); hh.setName("Home"); households.save(hh);
        var p = new Parent(); p.setHouseholdId(hh.getId()); p.setName(name); p.setEmail(email);
        p.setFirebaseUid("uid-" + email.substring(0, email.indexOf('@')));
        return parents.save(p);
    }

    private static Jwt token(String uid, String email) {
        return Jwt.withTokenValue("test").header("alg", "RS256").subject(uid).claim("email", email).claim("email_verified", true).build();
    }
}
