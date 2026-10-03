package com.family.missionhq.security;

import com.family.missionhq.household.Parent;
import com.family.missionhq.household.ParentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Turns a verified Firebase ID token into the caller: the parent it belongs to, or a {@link SignedInVisitor} — someone
 * signed in to Firebase who has no household here yet (they need an invite). A parent row is found by Firebase uid, or on
 * first sign-in by verified email, which is how parents created before Firebase keep their household.
 */
@Component @RequiredArgsConstructor @Slf4j
public class FirebaseParents implements Converter<Jwt, AbstractAuthenticationToken> {
    private static final String KEYS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
    private final ParentRepository parents;

    public record SignedInVisitor(String uid, String email, boolean emailVerified) {}

    /** Checks signature (Google's published keys, fetched lazily and cached), expiry, issuer and audience per Firebase's rules. */
    static JwtDecoder decoder(String projectId) {
        var decoder = NimbusJwtDecoder.withJwkSetUri(KEYS).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer("https://securetoken.google.com/" + projectId),
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD, aud -> aud != null && aud.contains(projectId))));
        return decoder;
    }

    @Override @Transactional
    public AbstractAuthenticationToken convert(Jwt jwt) {
        var uid = jwt.getSubject();
        var email = jwt.getClaimAsString("email");
        var verified = Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"));
        return parents.findByFirebaseUid(uid).or(() -> link(uid, email, verified))
                .<AbstractAuthenticationToken>map(p -> new UsernamePasswordAuthenticationToken(ParentPrincipal.of(p), jwt, List.of(new SimpleGrantedAuthority("ROLE_PARENT"))))
                .orElseGet(() -> new UsernamePasswordAuthenticationToken(new SignedInVisitor(uid, email, verified), jwt, List.of(new SimpleGrantedAuthority("ROLE_VISITOR"))));
    }

    /** First sign-in: attach this Firebase user to the parent with the same verified email, unless that parent already has one. */
    private Optional<Parent> link(String uid, String email, boolean verified) {
        if (!verified || email == null || email.isBlank()) return Optional.empty();
        return parents.findByEmailIgnoreCase(email).filter(p -> p.getFirebaseUid() == null).map(p -> {
            p.setFirebaseUid(uid);
            log.info("Linked parent {} to Firebase user {}", p.getId(), uid);
            return parents.save(p);
        });
    }
}
