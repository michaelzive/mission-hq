package com.family.missionhq.reward;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity @Getter @Setter
public class Reward {
    public enum Category { GEAR, GAME_TIME, OUTING, TREAT, OTHER }
    public enum Status { PENDING, ACTIVE, DECLINED, RETIRED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Long kidId;
    private String name;
    @Enumerated(EnumType.STRING) private Category category = Category.OTHER;
    private BigDecimal estimatedCost;
    private Integer price;
    private Integer tier;
    @Enumerated(EnumType.STRING) private Status status = Status.PENDING;
    private boolean suggestedByKid;
    private boolean manualPrice;
    @Column(name = "is_term_goal") private boolean termGoal;
    private boolean repeatable;

    public static int tierFor(int price) { return price > 500 ? 3 : price > 200 ? 2 : 1; }
}
