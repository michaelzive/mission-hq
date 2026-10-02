package com.family.missionhq.mission;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity @Getter @Setter
public class Behaviour {
    public enum Kind { DAILY, WEEKLY, BONUS }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long householdId;
    /** Null = every kid in the household; otherwise only this kid sees and can submit it. */
    private Long kidId;
    private String title;
    private int points;
    @Enumerated(EnumType.STRING) private Kind kind = Kind.DAILY;
    private boolean requiresPhoto = true;
    private LocalDate bonusDate;
    private boolean active = true;

    public boolean visibleOn(LocalDate date) {
        return active && (kind != Kind.BONUS || date.equals(bonusDate));
    }

    public boolean isFor(Long kidId) {
        return this.kidId == null || this.kidId.equals(kidId);
    }
}
