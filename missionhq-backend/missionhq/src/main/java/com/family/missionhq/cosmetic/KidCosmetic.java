package com.family.missionhq.cosmetic;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

@Entity @Getter @Setter
@IdClass(KidCosmetic.Key.class)
public class KidCosmetic {
    @Id private Long kidId;
    @Id private Long cosmeticItemId;
    private Instant acquiredAt = Instant.now();

    public static class Key implements Serializable {
        private Long kidId; private Long cosmeticItemId;
        public Key() {}
        public Key(Long kidId, Long cosmeticItemId) { this.kidId = kidId; this.cosmeticItemId = cosmeticItemId; }
        @Override public boolean equals(Object o) { return o instanceof Key k && k.kidId.equals(kidId) && k.cosmeticItemId.equals(cosmeticItemId); }
        @Override public int hashCode() { return kidId.hashCode() * 31 + cosmeticItemId.hashCode(); }
    }
}
