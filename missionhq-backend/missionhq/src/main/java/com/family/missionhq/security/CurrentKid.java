package com.family.missionhq.security;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component @RequiredArgsConstructor
public class CurrentKid {
    private final KidRepository kids;
    public Kid get() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof DeviceTokenFilter.KidPrincipal p)) throw DomainException.forbidden("device not paired");
        return kids.findById(p.kidId()).orElseThrow(() -> DomainException.notFound("kid"));
    }
}
