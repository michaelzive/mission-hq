package com.family.missionhq.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

/**
 * First cut: parents use HTTP Basic (single account from config), kids use device tokens.
 * Swap the in-memory parent for ParentRepository + JWT when you add multiple parents.
 */
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
    UserDetailsService parentUsers(@Value("${missionhq.parent.email}") String email,
                                   @Value("${missionhq.parent.password}") String password,
                                   PasswordEncoder enc) {
        return new InMemoryUserDetailsManager(User.withUsername(email).password(enc.encode(password)).roles("PARENT").build());
    }
}
