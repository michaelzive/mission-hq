package com.family.missionhq.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/** Needed once the PWAs are served from a different origin (e.g. Cloudflare Pages) than the API. */
@Configuration
public class CorsConfig {
    @Bean
    CorsFilter corsFilter(@Value("${missionhq.cors.allowed-origins:}") String allowedOrigins) {
        // space, comma or semicolon separated: the Cloud Run deploy action treats commas in env values as separators
        var origins = Arrays.stream(allowedOrigins.split("[\\s,;]+")).filter(s -> !s.isBlank()).toList();
        var cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(origins.isEmpty() ? List.of("http://localhost:4200", "http://localhost:4300") : origins);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        cfg.setAllowCredentials(true);
        var src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", cfg);
        return new CorsFilter(src);
    }
}
