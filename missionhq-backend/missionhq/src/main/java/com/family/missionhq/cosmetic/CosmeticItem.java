package com.family.missionhq.cosmetic;

import jakarta.persistence.*;
import lombok.Getter;

@Entity @Getter
public class CosmeticItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String themeCode;
    private String slot;
    private String name;
    private String assetKey;
    private int price;
    private int unlockRankOrdinal;

    /** Free from day one: everyone owns it implicitly. */
    public boolean isStarter() { return price == 0 && unlockRankOrdinal == 0; }
}
