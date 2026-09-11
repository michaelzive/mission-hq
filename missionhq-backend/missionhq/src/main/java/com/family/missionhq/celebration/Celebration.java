package com.family.missionhq.celebration;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** The animation queue. The kid app drains unplayed rows when HQ opens and acks each one. */
@Entity @Getter @Setter
public class Celebration {
    public enum Type { MISSION_APPROVED, BONUS, STREAK, RANK_UP, REDEEMED, SQUAD_MILESTONE, SIBLING_RANK_UP, HIGH_FIVE }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long kidId;
    @Enumerated(EnumType.STRING) private Type type;
    private Integer points;
    private Long refId;
    private String payload;
    private Instant createdAt = Instant.now();
    private Instant playedAt;
}
