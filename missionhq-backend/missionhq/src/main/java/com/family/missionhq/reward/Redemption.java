package com.family.missionhq.reward;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity @Getter @Setter
public class Redemption {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long kidId;
    private Long rewardId;
    private int pricePaid;
    private Instant redeemedAt = Instant.now();
    private Instant fulfilledAt;
    private Long fulfilledBy;
}
