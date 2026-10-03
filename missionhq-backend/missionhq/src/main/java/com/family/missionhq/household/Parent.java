package com.family.missionhq.household;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity @Getter @Setter
public class Parent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long householdId;
    private String name;
    private String email;
    /** Only backs the transitional HTTP Basic sign-in; null for parents who only use Firebase. */
    private String passwordHash;
    /** Firebase Authentication user id, attached on first verified sign-in. */
    private String firebaseUid;
    /** Set when another parent removed this one; the row stays for history but can no longer sign in. */
    private Instant removedAt;
    private String pushToken;
}
