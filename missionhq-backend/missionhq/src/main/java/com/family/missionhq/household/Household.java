package com.family.missionhq.household;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Getter @Setter
public class Household {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String name;
    private BigDecimal pointsPerCurrencyUnit = BigDecimal.ONE;
    private String currency = "ZAR";
    private String seasonName = "Season 1";
    private LocalDate seasonStart = LocalDate.now();

    /** Points a reward should cost given its real-world price. */
    public int suggestedPrice(BigDecimal estimatedCost) {
        if (estimatedCost == null) return 0;
        return estimatedCost.multiply(pointsPerCurrencyUnit).setScale(0, java.math.RoundingMode.HALF_UP).intValue();
    }
}
