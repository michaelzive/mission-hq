package com.family.missionhq.household;

import com.family.missionhq.common.DomainException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

/**
 * Who belongs to a household. Parents invite each other with single-use links that expire after a week; whoever opens the
 * link signs in to Firebase and becomes a parent there. All parents are equal: any parent can invite, cancel invites and
 * remove another parent, never themselves, so a household always keeps at least one. One household per account.
 */
@Service @RequiredArgsConstructor @Slf4j
public class HouseholdMembers {
    static final Duration INVITE_LIFETIME = Duration.ofDays(7);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final ParentRepository parents;
    private final ParentInviteRepository invites;

    public record CreatedInvite(ParentInvite invite, String token) {}
    public enum InviteStatus { OPEN, EXPIRED, USED, CANCELLED }
    public record InvitePreview(String invitedBy, InviteStatus status) {}

    @Transactional(readOnly = true)
    public List<Parent> parentsOf(Parent me) { return parents.findByHouseholdIdAndRemovedAtIsNullOrderByIdAsc(me.getHouseholdId()); }

    @Transactional
    public Parent rename(Parent me, String name) {
        me.setName(cleanName(name));
        return parents.save(me);
    }

    /** The token goes back to the caller once, to put in the link; only its hash is kept. */
    @Transactional
    public CreatedInvite invite(Parent me) {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        var token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        var now = Instant.now();
        var i = new ParentInvite();
        i.setHouseholdId(me.getHouseholdId());
        i.setTokenHash(hash(token));
        i.setCreatedBy(me.getId());
        i.setCreatedAt(now);
        i.setExpiresAt(now.plus(INVITE_LIFETIME));
        return new CreatedInvite(invites.save(i), token);
    }

    @Transactional(readOnly = true)
    public List<ParentInvite> openInvites(Parent me) {
        return invites.findByHouseholdIdAndAcceptedAtIsNullAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtAsc(me.getHouseholdId(), Instant.now());
    }

    @Transactional
    public void cancel(Parent me, Long inviteId) {
        var i = invites.findById(inviteId).filter(x -> x.getHouseholdId().equals(me.getHouseholdId()))
                .orElseThrow(() -> DomainException.notFound("invite"));
        if (i.getAcceptedAt() != null) throw DomainException.conflict("that invite has already been used");
        if (i.getRevokedAt() == null) i.setRevokedAt(Instant.now());
    }

    /** What the join screen shows before anyone signs in. Unknown tokens read as not found. */
    @Transactional(readOnly = true)
    public InvitePreview preview(String token) {
        var i = invites.findByTokenHash(hash(token)).orElseThrow(() -> DomainException.notFound("invite"));
        var by = parents.findById(i.getCreatedBy()).map(Parent::getName).orElse("A parent");
        return new InvitePreview(by, status(i, Instant.now()));
    }

    /** A signed-in Firebase user with no household joins the inviting household as a new parent. */
    @Transactional
    public Parent accept(String token, String firebaseUid, String email, boolean emailVerified, String name) {
        if (!emailVerified) throw DomainException.forbidden("verify your email address first");
        if (email == null || email.isBlank()) throw DomainException.badRequest("this account has no email address");
        if (parents.findByFirebaseUid(firebaseUid).isPresent()) throw DomainException.conflict("this account is already part of a family on Mission HQ");
        var i = invites.findForUpdateByTokenHash(hash(token)).orElseThrow(() -> DomainException.notFound("invite"));
        switch (status(i, Instant.now())) {
            case EXPIRED -> throw DomainException.conflict("this invite has expired; ask for a new one");
            case USED -> throw DomainException.conflict("this invite has already been used");
            case CANCELLED -> throw DomainException.conflict("this invite was cancelled");
            case OPEN -> { }
        }
        if (parents.findByEmailIgnoreCase(email).isPresent()) throw DomainException.conflict("there is already a parent with this email on Mission HQ");
        var p = new Parent();
        p.setHouseholdId(i.getHouseholdId());
        p.setName(cleanName(name));
        p.setEmail(email);
        p.setFirebaseUid(firebaseUid);
        parents.save(p);
        i.setAcceptedBy(p.getId());
        i.setAcceptedAt(Instant.now());
        log.info("Parent {} joined household {} via invite {}", p.getId(), i.getHouseholdId(), i.getId());
        return p;
    }

    /** Keeps the row (history points at it) but strips every way to sign in, effective on their next request. */
    @Transactional
    public void remove(Parent me, Long parentId) {
        if (me.getId().equals(parentId)) throw DomainException.badRequest("you can't remove yourself; ask another parent to");
        var p = parents.findById(parentId)
                .filter(x -> x.getHouseholdId().equals(me.getHouseholdId()) && x.getRemovedAt() == null)
                .orElseThrow(() -> DomainException.notFound("parent"));
        p.setEmail(null);
        p.setFirebaseUid(null);
        p.setPasswordHash(null);
        p.setPushToken(null);
        p.setRemovedAt(Instant.now());
        log.info("Parent {} removed parent {} from household {}", me.getId(), p.getId(), p.getHouseholdId());
    }

    private static InviteStatus status(ParentInvite i, Instant now) {
        if (i.getAcceptedAt() != null) return InviteStatus.USED;
        if (i.getRevokedAt() != null) return InviteStatus.CANCELLED;
        return now.isBefore(i.getExpiresAt()) ? InviteStatus.OPEN : InviteStatus.EXPIRED;
    }

    private static String cleanName(String name) {
        var n = name == null ? "" : name.trim();
        if (n.isEmpty() || n.length() > 60) throw DomainException.badRequest("name must be 1-60 characters");
        return n;
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
