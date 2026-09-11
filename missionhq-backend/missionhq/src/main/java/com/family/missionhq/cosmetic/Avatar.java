package com.family.missionhq.cosmetic;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Getter @Setter
public class Avatar {
    @Id private Long kidId;
    private int colour;
    /** JSON object of slot -> asset key. Stored as text to stay DB-agnostic. */
    @Column(columnDefinition = "text") private String slots = "{}";
}
