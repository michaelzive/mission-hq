package com.family.missionhq.rank;

import jakarta.persistence.*;
import lombok.Getter;

import java.io.Serializable;

@Entity @Getter
@IdClass(RankDefinition.Key.class)
public class RankDefinition {
    @Id private String themeCode;
    @Id private int ordinal;
    private String name;
    private int threshold;

    public static class Key implements Serializable {
        private String themeCode;
        private int ordinal;
        @Override public boolean equals(Object o) { return o instanceof Key k && k.ordinal == ordinal && k.themeCode.equals(themeCode); }
        @Override public int hashCode() { return themeCode.hashCode() * 31 + ordinal; }
    }
}
