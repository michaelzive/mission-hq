package com.family.missionhq.household;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

@Entity @Getter @Setter
public class Household {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String name;
    private BigDecimal pointsPerCurrencyUnit = BigDecimal.ONE;
    private String currency = "ZAR";
    private String seasonName = "Season 1";
    private LocalDate seasonStart = LocalDate.now();
    /** IANA zone the family lives in; every "today" a kid sees is computed here. */
    private String timezone = "Africa/Johannesburg";
    /** Local time of the evening "missions still open" push; null = off. */
    @Convert(converter = WallClockTimeConverter.class) private LocalTime reminderTime = LocalTime.of(18, 30);
    @JsonIgnore private LocalDate lastReminderDate;
    /** Share (1-100) of a mission's points paid when a parent logs it for a kid. */
    private int parentLogPercent = 50;

    /** Points a reward should cost given its real-world price. */
    public int suggestedPrice(BigDecimal estimatedCost) {
        if (estimatedCost == null) return 0;
        return estimatedCost.multiply(pointsPerCurrencyUnit).setScale(0, java.math.RoundingMode.HALF_UP).intValue();
    }

    /** What a parent-logged mission worth {@code points} pays: never zero, rounded up. */
    public int parentLogPoints(int points) {
        return Math.max(1, (points * parentLogPercent + 99) / 100);
    }

    public ZoneId zone() { return ZoneId.of(timezone); }
}
