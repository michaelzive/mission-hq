package com.family.missionhq.security;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.Parent;
import com.family.missionhq.household.ParentRepository;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component @RequiredArgsConstructor
public class CurrentParent {
    private final ParentRepository parents;
    private final KidRepository kids;

    public Parent get() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof ParentPrincipal p)) throw DomainException.forbidden("parent sign-in required");
        return parents.findById(p.id()).orElseThrow(() -> DomainException.notFound("parent"));
    }

    /** A kid in the signed-in parent's household. Other households' kids read as not found so ids never leak. */
    public Kid kid(Long kidId) {
        var householdId = get().getHouseholdId();
        return kids.findById(kidId).filter(k -> k.getHouseholdId().equals(householdId))
                .orElseThrow(() -> DomainException.notFound("kid"));
    }
}
