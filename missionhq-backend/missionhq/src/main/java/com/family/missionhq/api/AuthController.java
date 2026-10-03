package com.family.missionhq.api;

import com.family.missionhq.household.Admins;
import com.family.missionhq.security.FirebaseParents;
import com.family.missionhq.security.ParentPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Who the signed-in caller is, so the parent app can tell a parent from someone who still needs an invite. */
@RestController @RequestMapping("/api/v1/auth") @RequiredArgsConstructor
public class AuthController {
    private final Admins admins;

    /** {@code parent} false = signed in to Firebase but not in any household yet; {@code admin} may invite new families. */
    public record Me(boolean parent, String email, boolean emailVerified, boolean admin) {}

    @GetMapping("/me")
    public Me me(Authentication auth) {
        return switch (auth.getPrincipal()) {
            case ParentPrincipal p -> new Me(true, p.email(), true, admins.isAdmin(p.email()));
            case FirebaseParents.SignedInVisitor v -> new Me(false, v.email(), v.emailVerified(), false);
            default -> throw new IllegalStateException("unexpected principal");
        };
    }
}
