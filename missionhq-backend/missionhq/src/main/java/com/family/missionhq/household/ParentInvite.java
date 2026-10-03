package com.family.missionhq.household;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity @Getter @Setter
public class ParentInvite {
    /** PARENT joins {@link #householdId}; FAMILY (household null) starts a new household. */
    public enum Kind { PARENT, FAMILY }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) private Kind kind = Kind.PARENT;
    private Long householdId;
    /** SHA-256 (hex) of the token in the invite link; the token itself is never stored. */
    private String tokenHash;
    private Long createdBy;
    private Instant createdAt;
    private Instant expiresAt;
    private Long acceptedBy;
    private Instant acceptedAt;
    private Instant revokedAt;
}
