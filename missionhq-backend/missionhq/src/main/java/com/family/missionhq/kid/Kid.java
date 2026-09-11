package com.family.missionhq.kid;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity @Getter @Setter
public class Kid {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long householdId;
    private String callsign;
    private String themeCode = "AIRSOFT";
    /** Cached from the ledger. LedgerService is the only writer. */
    private int balance;
    private int lifetimeEarned;
    private int rankOrdinal;
    private int streakDays;
    private LocalDate streakLastDate;
    private int prestigeStars;
}
