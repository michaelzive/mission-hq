package com.family.missionhq.push;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity @Getter @Setter
public class PushSubscription {
    public enum OwnerType { KID, PARENT }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) private OwnerType ownerType;
    private Long ownerId;
    @Column(length = 600) private String endpoint;
    private String p256dh;
    private String auth;
    private Instant createdAt = Instant.now();
}
