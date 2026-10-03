package com.family.missionhq.mission;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity @Getter @Setter
public class MissionCompletion {
    public enum Status { PENDING, APPROVED, SENT_BACK }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long kidId;
    private Long behaviourId;
    private LocalDate missionDate;
    @Enumerated(EnumType.STRING) private Status status = Status.PENDING;
    private String photoKey;
    private Instant submittedAt = Instant.now();
    private Instant reviewedAt;
    /** Null when the report was approved automatically (a mission that needs no photo). */
    private Long reviewedBy;
    private String note;
    /** A parent logged it for the kid: paid at the household's parent-log rate, never counts toward the streak. */
    private boolean loggedByParent;
    /** The mission points actually paid, before any extra bonus. Null until approved. */
    private Integer pointsAwarded;
}
