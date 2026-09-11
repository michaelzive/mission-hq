package com.family.missionhq.security;

import com.family.missionhq.kid.DeviceRepository;
import com.family.missionhq.kid.KidRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

/** Requests carrying "Authorization: Device <token>" are resolved to a KidPrincipal. */
@Component @RequiredArgsConstructor
public class DeviceTokenFilter extends OncePerRequestFilter {
    private final DeviceRepository devices;
    private final KidRepository kids;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws IOException, jakarta.servlet.ServletException {
        var header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Device ")) {
            devices.findByDeviceToken(header.substring(7).trim()).ifPresent(d -> {
                d.setLastSeenAt(Instant.now());
                devices.save(d);
                var kid = kids.findById(d.getKidId()).orElseThrow();
                var auth = new UsernamePasswordAuthenticationToken(new KidPrincipal(kid.getId()), null, List.of(new SimpleGrantedAuthority("ROLE_KID")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(req, res);
    }

    public record KidPrincipal(Long kidId) {}
}
