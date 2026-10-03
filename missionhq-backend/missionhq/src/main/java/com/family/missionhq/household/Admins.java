package com.family.missionhq.household;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** The people who may invite new families: parents whose email is listed in missionhq.admin-emails (space or comma separated). */
@Component
public class Admins {
    private final Set<String> emails;

    public Admins(@Value("${missionhq.admin-emails:}") String configured) {
        this.emails = Arrays.stream(configured.split("[,\s]+")).map(String::trim).filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdmin(String email) { return email != null && emails.contains(email.toLowerCase(Locale.ROOT)); }
}
