package com.family.missionhq.household;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Makes a blank database usable with nothing but PARENT_EMAIL / PARENT_PASSWORD: creates the first household and
 * parent if that email is unknown, and keeps the stored hash in step with the configured password so rotating the
 * env var still works. Pointing PARENT_EMAIL at a new address creates a new household, not a second login for the old one.
 */
@Component @RequiredArgsConstructor @Slf4j
public class ParentBootstrap implements ApplicationRunner {
    private final ParentRepository parents;
    private final HouseholdRepository households;
    private final PasswordEncoder encoder;
    @Value("${missionhq.parent.email:}") private String email;
    @Value("${missionhq.parent.password:}") private String password;

    @Override @Transactional
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank()) return;
        var existing = parents.findByEmail(email);
        if (existing.isPresent()) {
            var p = existing.get();
            if (!encoder.matches(password, p.getPasswordHash())) { p.setPasswordHash(encoder.encode(password)); log.info("Updated password for parent {}", email); }
            return;
        }
        var hh = new Household();
        hh.setName("Home");
        households.save(hh);
        var p = new Parent();
        p.setHouseholdId(hh.getId()); p.setName("Parent"); p.setEmail(email); p.setPasswordHash(encoder.encode(password));
        parents.save(p);
        log.info("Bootstrapped household {} with parent {}", hh.getId(), email);
    }
}
