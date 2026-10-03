package com.family.missionhq.security;

import com.family.missionhq.household.Household;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.household.Parent;
import com.family.missionhq.household.ParentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/** Which Firebase sign-ins become which parent. Tokens are built directly; signature checks are Spring's job. Requires Docker. */
@SpringBootTest @Testcontainers @ActiveProfiles("dev")
class FirebaseParentsIT {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired FirebaseParents firebase;
    @Autowired ParentRepository parents;
    @Autowired HouseholdRepository households;

    @Test void aVerifiedEmailLinksTheExistingParentOnceAndTheUidWinsAfterThat() {
        var mum = parent("Mum@Example.com");

        var first = firebase.convert(token("uid-mum", "mum@example.com", true));
        assertThat(first.getPrincipal()).isInstanceOf(ParentPrincipal.class).extracting("id").isEqualTo(mum.getId());
        assertThat(first.getAuthorities()).extracting("authority").containsExactly("ROLE_PARENT");
        assertThat(parents.findById(mum.getId()).orElseThrow().getFirebaseUid()).isEqualTo("uid-mum");

        // email changed in Google later: still the same parent, found by uid
        assertThat(firebase.convert(token("uid-mum", "mum.new@example.com", true)).getPrincipal()).extracting("id").isEqualTo(mum.getId());
    }

    @Test void anUnverifiedEmailNeverLinks() {
        var gran = parent("gran@example.com");

        var auth = firebase.convert(token("uid-gran", "gran@example.com", false));
        assertThat(auth.getPrincipal()).isEqualTo(new FirebaseParents.SignedInVisitor("uid-gran", "gran@example.com", false));
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_VISITOR");
        assertThat(parents.findById(gran.getId()).orElseThrow().getFirebaseUid()).isNull();
    }

    @Test void aParentAlreadyLinkedCannotBeClaimedByAnotherFirebaseUserWithTheSameEmail() {
        var dad = parent("dad2@example.com");
        firebase.convert(token("uid-dad", "dad2@example.com", true));

        assertThat(firebase.convert(token("uid-impostor", "dad2@example.com", true)).getPrincipal()).isInstanceOf(FirebaseParents.SignedInVisitor.class);
        assertThat(parents.findById(dad.getId()).orElseThrow().getFirebaseUid()).isEqualTo("uid-dad");
    }

    @Test void someoneWithNoHouseholdIsAVisitor() {
        assertThat(firebase.convert(token("uid-stranger", "stranger@example.com", true)).getPrincipal())
                .isEqualTo(new FirebaseParents.SignedInVisitor("uid-stranger", "stranger@example.com", true));
    }

    private Parent parent(String email) {
        var hh = new Household(); hh.setName("Home"); households.save(hh);
        var p = new Parent(); p.setHouseholdId(hh.getId()); p.setName("Parent"); p.setEmail(email);
        return parents.save(p);
    }

    private static Jwt token(String uid, String email, boolean verified) {
        return Jwt.withTokenValue("test").header("alg", "RS256").subject(uid).claim("email", email).claim("email_verified", verified).build();
    }
}
