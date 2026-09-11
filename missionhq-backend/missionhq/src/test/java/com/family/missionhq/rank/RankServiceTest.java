package com.family.missionhq.rank;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RankServiceTest {
    private RankDefinition rank(int ordinal, int threshold) {
        var r = new RankDefinition();
        try {
            var f = RankDefinition.class.getDeclaredField("ordinal"); f.setAccessible(true); f.set(r, ordinal);
            var g = RankDefinition.class.getDeclaredField("threshold"); g.setAccessible(true); g.set(r, threshold);
        } catch (Exception e) { throw new RuntimeException(e); }
        return r;
    }
    private final List<RankDefinition> ladder = List.of(rank(0,0), rank(1,100), rank(2,300), rank(3,700));

    @Test void zeroPointsIsFirstRank() { assertThat(RankService.ordinalFor(ladder, 0)).isZero(); }
    @Test void exactThresholdPromotes() { assertThat(RankService.ordinalFor(ladder, 100)).isEqualTo(1); }
    @Test void betweenThresholdsStays() { assertThat(RankService.ordinalFor(ladder, 299)).isEqualTo(1); }
    @Test void beyondLastThresholdIsTopRank() { assertThat(RankService.ordinalFor(ladder, 99_999)).isEqualTo(3); }
}
