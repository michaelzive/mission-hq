package com.family.missionhq.mission;

import com.family.missionhq.celebration.Celebration;
import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.household.ParentRepository;
import com.family.missionhq.kid.KidRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** End-to-end: submit -> approve -> ledger, celebration queue and rank-up all land in one transaction. Requires Docker. */
@SpringBootTest @Testcontainers @ActiveProfiles("dev")
class MissionFlowIT {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired MissionService missions;
    @Autowired KidRepository kids;
    @Autowired ParentRepository parents;
    @Autowired CelebrationService celebrations;
    @Autowired MissionCompletionRepository completions;

    @Test void approvingMissionsAwardsPointsQueuesCelebrationsAndRanksUp() {
        var kid = kids.findById(1L).orElseThrow();            // Viper from V2 seed
        var parent = parents.findByEmail("dad@example.com").orElseThrow(); // V3 seed
        var today = LocalDate.now();

        var c1 = missions.submit(kid, 1L, today, "photo-1");  // Homework 20
        missions.approve(c1.getId(), parent, 5);              // +20, +5 bonus

        var c2 = missions.submit(kid, 2L, today, "photo-2");  // Reading 15
        missions.approve(c2.getId(), parent, 0);

        var c3 = missions.submit(kid, 3L, today, "photo-3");  // Bonus 30 -> lifetime 70
        missions.approve(c3.getId(), parent, 30);             // +30 extra -> lifetime 100 -> Private

        kid = kids.findById(1L).orElseThrow();
        assertThat(kid.getBalance()).isEqualTo(100);
        assertThat(kid.getLifetimeEarned()).isEqualTo(100);
        assertThat(kid.getRankOrdinal()).isEqualTo(1);
        assertThat(kid.getStreakDays()).isEqualTo(1);

        var queue = celebrations.unplayed(1L);
        assertThat(queue).extracting(Celebration::getType)
            .containsSubsequence(Celebration.Type.MISSION_APPROVED, Celebration.Type.BONUS, Celebration.Type.RANK_UP);
        assertThat(queue).filteredOn(c -> c.getType() == Celebration.Type.RANK_UP).hasSize(1);

        // sibling hears about it, rank only
        assertThat(celebrations.unplayed(2L)).extracting(Celebration::getType).contains(Celebration.Type.SIBLING_RANK_UP);
    }
}
