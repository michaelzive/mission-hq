package com.family.missionhq.api;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.mission.MissionReminder;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Wake-up call from Cloud Scheduler (every 15 minutes), since a scaled-to-zero Cloud Run service runs no timers of its own.
 * Guarded by a shared secret in X-Tick-Secret; with no secret configured the endpoint doesn't exist.
 */
@RestController @RequiredArgsConstructor
public class TickController {
    private final MissionReminder reminder;
    @Value("${missionhq.tick-secret:}") private String secret;

    @PostMapping("/api/v1/internal/tick")
    public Map<String, Integer> tick(@RequestHeader(value = "X-Tick-Secret", required = false) String given) {
        if (secret.isBlank()) throw DomainException.notFound("endpoint");
        if (given == null || !MessageDigest.isEqual(secret.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8)))
            throw DomainException.forbidden("bad tick secret");
        return Map.of("reminded", reminder.tick());
    }
}
