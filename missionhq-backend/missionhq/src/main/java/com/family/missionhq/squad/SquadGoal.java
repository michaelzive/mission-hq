package com.family.missionhq.squad;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Getter @Setter
public class SquadGoal {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long householdId;
    private String name;
    private int targetPoints;
    private String seasonName;
    private String status = "ACTIVE";
}
