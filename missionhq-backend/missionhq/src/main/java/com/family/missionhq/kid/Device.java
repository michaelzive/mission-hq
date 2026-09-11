package com.family.missionhq.kid;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity @Getter @Setter
public class Device {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long kidId;
    private String pairingCode;
    private String deviceToken;
    private Instant pairedAt;
    private Instant lastSeenAt;
}
