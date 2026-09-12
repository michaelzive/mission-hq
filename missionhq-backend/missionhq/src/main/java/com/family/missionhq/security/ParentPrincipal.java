package com.family.missionhq.security;

import com.family.missionhq.household.Parent;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public record ParentPrincipal(Long id, Long householdId, String email, String passwordHash) implements UserDetails {
    static ParentPrincipal of(Parent p) { return new ParentPrincipal(p.getId(), p.getHouseholdId(), p.getEmail(), p.getPasswordHash()); }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return List.of(new SimpleGrantedAuthority("ROLE_PARENT")); }
    @Override public String getPassword() { return passwordHash; }
    @Override public String getUsername() { return email; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
