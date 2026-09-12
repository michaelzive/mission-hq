package com.family.missionhq.security;

import com.family.missionhq.household.ParentRepository;
import lombok.RequiredArgsConstructor;
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

/** Parents use HTTP Basic against the parent table; kids use device tokens. */
@Configuration @RequiredArgsConstructor
public class SecurityConfig {
    private final DeviceTokenFilter deviceTokenFilter;

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .cors(c -> {})
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(deviceTokenFilter, BasicAuthenticationFilter.class)
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/v1/devices/pair", "/api/v1/photos/**", "/api/v1/push/public-key", "/actuator/health").permitAll()
                .requestMatchers("/api/v1/me/**").hasRole("KID")
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
