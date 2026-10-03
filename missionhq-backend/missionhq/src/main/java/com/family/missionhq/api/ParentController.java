package com.family.missionhq.api;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.HouseholdMembers;
import com.family.missionhq.household.Parent;
import com.family.missionhq.household.ParentInvite;
import com.family.missionhq.household.ParentRepository;
import com.family.missionhq.security.CurrentParent;
import com.family.missionhq.security.FirebaseParents;
import com.family.missionhq.security.ParentPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/** The parents of a household and the invites that add more. Everything but preview/accept is scoped to the caller's household. */
@RestController @RequestMapping("/api/v1") @RequiredArgsConstructor
public class ParentController {
    private final CurrentParent current;
    private final HouseholdMembers members;
    private final ParentRepository parents;

    public record ParentView(Long id, String name, String email, boolean you) {}
    public record NameInput(@NotBlank @Size(max = 60) String name) {}
    public record InviteView(Long id, String invitedBy, Instant createdAt, Instant expiresAt) {}
    /** {@code token} is only ever returned here, for the parent app to build the link. */
    public record CreatedInviteView(Long id, String token, Instant expiresAt) {}
    public record AcceptInput(@NotBlank String token, @NotBlank @Size(max = 60) String name) {}

    @GetMapping("/parents")
    public List<ParentView> list() {
        var me = current.get();
        return members.parentsOf(me).stream().map(p -> new ParentView(p.getId(), p.getName(), p.getEmail(), p.getId().equals(me.getId()))).toList();
    }

    @PutMapping("/parents/me")
    public ParentView rename(@Valid @RequestBody NameInput body) {
        var p = members.rename(current.get(), body.name());
        return new ParentView(p.getId(), p.getName(), p.getEmail(), true);
    }

    @DeleteMapping("/parents/{id}")
    public void remove(@PathVariable Long id) { members.remove(current.get(), id); }

    @GetMapping("/invites")
    public List<InviteView> invites() {
        return members.openInvites(current.get()).stream().map(this::view).toList();
    }

    @PostMapping("/invites")
    public CreatedInviteView invite() {
        var created = members.invite(current.get());
        return new CreatedInviteView(created.invite().getId(), created.token(), created.invite().getExpiresAt());
    }

    @DeleteMapping("/invites/{id}")
    public void cancel(@PathVariable Long id) { members.cancel(current.get(), id); }

    /** Public: the token is the secret. Lets the join screen say who sent the invite before anyone signs in. */
    @GetMapping("/invites/preview")
    public HouseholdMembers.InvitePreview preview(@RequestParam String token) { return members.preview(token); }

    @PostMapping("/invites/accept")
    public AuthController.Me accept(@Valid @RequestBody AcceptInput body, Authentication auth) {
        if (auth.getPrincipal() instanceof ParentPrincipal) throw DomainException.conflict("this account is already part of a family on Mission HQ");
        var v = (FirebaseParents.SignedInVisitor) auth.getPrincipal();
        var p = members.accept(body.token(), v.uid(), v.email(), v.emailVerified(), body.name());
        return new AuthController.Me(true, p.getEmail(), true);
    }

    private InviteView view(ParentInvite i) {
        var by = parents.findById(i.getCreatedBy()).map(Parent::getName).orElse("A parent");
        return new InviteView(i.getId(), by, i.getCreatedAt(), i.getExpiresAt());
    }
}
