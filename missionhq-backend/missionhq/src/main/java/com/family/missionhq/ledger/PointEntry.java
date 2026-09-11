package com.family.missionhq.ledger;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Append-only. Never updated or deleted; corrections are new rows. */
@Entity @Getter @Setter
public class PointEntry {
    public enum Type { MISSION, BONUS, STREAK_BONUS, REDEMPTION, CORRECTION }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long kidId;
    private int points;
    @Enumerated(EnumType.STRING) private Type type;
    private Long refId;
    private String reason;
    private Instant createdAt = Instant.now();
    private Long createdBy;
}
