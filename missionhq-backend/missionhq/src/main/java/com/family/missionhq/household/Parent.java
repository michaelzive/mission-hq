package com.family.missionhq.household;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Getter @Setter
public class Parent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long householdId;
    private String name;
    private String email;
    private String passwordHash;
    private String pushToken;
}
