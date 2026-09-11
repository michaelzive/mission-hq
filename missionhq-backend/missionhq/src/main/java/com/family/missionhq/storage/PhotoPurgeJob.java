package com.family.missionhq.storage;

import com.family.missionhq.mission.MissionCompletion;
import com.family.missionhq.mission.MissionCompletionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/** Photos are evidence, not keepsakes: delete them N days after approval. The ledger entry stays. */
@Component @RequiredArgsConstructor
public class PhotoPurgeJob {
    private final MissionCompletionRepository completions;
    private final PhotoStorage storage;
    private final StorageProperties props;

    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void purge() {
        var cutoff = Instant.now().minus(Duration.ofDays(props.photoTtlDays()));
        for (var c : completions.findByStatusAndPhotoKeyIsNotNullAndReviewedAtBefore(MissionCompletion.Status.APPROVED, cutoff)) {
            storage.delete(c.getPhotoKey());
            c.setPhotoKey(null);
        }
    }
}
