package com.family.missionhq.security;

import com.family.missionhq.household.ParentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

/**
 * Kids use device tokens. Parents sign in with Firebase ID tokens ("Authorization: Bearer"), resolved by FirebaseParents,
 * when missionhq.firebase.project-id is set; HTTP Basic against the parent table stays alongside for one transition release.
 */
@Configuration @RequiredArgsConstructor
public class SecurityConfig {
    private final DeviceTokenFilter deviceTokenFilter;
    private final FirebaseParents firebaseParents;
    @Value("${missionhq.firebase.project-id:}") private String firebaseProjectId;

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        if (!firebaseProjectId.isBlank()) {
            http.oauth2ResourceServer(o -> o.jwt(j -> j.decoder(FirebaseParents.decoder(firebaseProjectId)).jwtAuthenticationConverter(firebaseParents)));
        }
        return http
            .csrf(csrf -> csrf.disable())
            .cors(c -> {})
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(deviceTokenFilter, BasicAuthenticationFilter.class)
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/v1/devices/pair", "/api/v1/photos/**", "/api/v1/push/public-key", "/api/v1/invites/preview", "/api/v1/internal/tick", "/actuator/health").permitAll()
                .requestMatchers("/api/v1/me/**").hasRole("KID")
                .requestMatchers("/api/v1/auth/me", "/api/v1/invites/accept").hasAnyRole("PARENT", "VISITOR")
                .requestMatchers("/api/v1/**").hasRole("PARENT")
                .anyRequest().denyAll())
            .httpBasic(b -> {})
            .build();
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    UserDetailsService parentUsers(ParentRepository parents) {
        return email -> parents.findByEmail(email).map(ParentPrincipal::of)
                .orElseThrow(() -> new UsernameNotFoundException("no parent with email " + email));
    }
}
