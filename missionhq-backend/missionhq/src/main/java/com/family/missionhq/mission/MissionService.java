package com.family.missionhq.mission;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.common.DomainException;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.LedgerService;
import com.family.missionhq.ledger.PointEntry;
import com.family.missionhq.push.PushRequested;
import com.family.missionhq.storage.PhotoStorage;
import org.springframework.context.ApplicationEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service @RequiredArgsConstructor
public class MissionService {
    private final MissionCompletionRepository completions;
    private final BehaviourRepository behaviours;
    private final KidRepository kids;
    private final LedgerService ledger;
    private final CelebrationService celebrations;
    private final PhotoStorage photos;
    private final ApplicationEventPublisher events;

    public record MissionCard(Long behaviourId, String title, int points, boolean bonus, boolean requiresPhoto, String status) {}

    @Transactional(readOnly = true)
    public List<MissionCard> cardsFor(Kid kid, LocalDate date) {
        var done = completions.findByKidIdAndMissionDate(kid.getId(), date);
        return behaviours.findByHouseholdIdAndActiveTrue(kid.getHouseholdId()).stream()
                .filter(b -> b.visibleOn(date))
                .map(b -> {
                    var c = done.stream().filter(x -> x.getBehaviourId().equals(b.getId())).findFirst();
                    var status = c.map(x -> x.getStatus() == MissionCompletion.Status.SENT_BACK ? "TODO" : x.getStatus().name()).orElse("TODO");
                    return new MissionCard(b.getId(), b.getTitle(), b.getPoints(), b.getKind() == Behaviour.Kind.BONUS, b.isRequiresPhoto(), status);
                }).toList();
    }

    /** Presigned upload ticket. Key is deterministic per kid/behaviour/day so a retry overwrites rather than orphans. */
    public PhotoStorage.UploadTicket photoTicket(Kid kid, Long behaviourId, LocalDate date) {
        var key = "missions/" + kid.getId() + "/" + date + "/" + behaviourId + ".jpg";
        return photos.presignUpload(key, "image/jpeg", java.time.Duration.ofMinutes(10));
    }

    @Transactional
    public MissionCompletion submit(Kid kid, Long behaviourId, LocalDate date, String photoKey) {
        var b = behaviours.findById(behaviourId).orElseThrow(() -> DomainException.notFound("behaviour"));
        if (!b.getHouseholdId().equals(kid.getHouseholdId()) || !b.visibleOn(date)) throw DomainException.badRequest("mission not available today");
        if (b.isRequiresPhoto() && (photoKey == null || photoKey.isBlank())) throw DomainException.badRequest("photo required");
        var existing = completions.findByKidIdAndBehaviourIdAndMissionDate(kid.getId(), behaviourId, date);
        MissionCompletion c;
        if (existing.isPresent()) {
            c = existing.get();
            if (c.getStatus() != MissionCompletion.Status.SENT_BACK) throw DomainException.conflict("already submitted today");
            c.setStatus(MissionCompletion.Status.PENDING);
            c.setNote(null);
        } else {
            c = new MissionCompletion();
            c.setKidId(kid.getId());
            c.setBehaviourId(behaviourId);
            c.setMissionDate(date);
        }
        c.setPhotoKey(photoKey);
        c.setSubmittedAt(Instant.now());
        var saved = completions.save(c);
        events.publishEvent(PushRequested.parents("Mission report from " + kid.getCallsign(), b.getTitle() + " · " + b.getPoints() + " pts, waiting for your OK", "/approvals"));
        return saved;
    }

    @Transactional
    public void approve(Long completionId, Long parentId, int extraBonus) {
        var c = completions.findById(completionId).orElseThrow(() -> DomainException.notFound("completion"));
        if (c.getStatus() != MissionCompletion.Status.PENDING) throw DomainException.conflict("not pending");
        var b = behaviours.findById(c.getBehaviourId()).orElseThrow();
        var kid = kids.findById(c.getKidId()).orElseThrow();

        c.setStatus(MissionCompletion.Status.APPROVED);
        c.setReviewedAt(Instant.now());
        c.setReviewedBy(parentId);

        ledger.award(kid, b.getPoints(), PointEntry.Type.MISSION, c.getId(), b.getTitle(), parentId);
        celebrations.missionApproved(kid, c.getId(), b.getPoints(), b.getId());
        if (extraBonus > 0) {
            ledger.award(kid, extraBonus, PointEntry.Type.BONUS, c.getId(), "HQ impressed", parentId);
            celebrations.bonus(kid, extraBonus, "HQ impressed");
        }
        updateStreak(kid, c.getMissionDate(), parentId);
        events.publishEvent(PushRequested.kid(kid.getId(), "HQ has news for you", b.getTitle() + " confirmed. Open HQ to collect.", "/hq"));
    }

    @Transactional
    public void sendBack(Long completionId, Long parentId, String note) {
        var c = completions.findById(completionId).orElseThrow(() -> DomainException.notFound("completion"));
        if (c.getStatus() != MissionCompletion.Status.PENDING) throw DomainException.conflict("not pending");
        c.setStatus(MissionCompletion.Status.SENT_BACK);
        c.setReviewedAt(Instant.now());
        c.setReviewedBy(parentId);
        c.setNote(note);
        if (c.getPhotoKey() != null) photos.delete(c.getPhotoKey());
        c.setPhotoKey(null);
        var kid = kids.findById(c.getKidId()).orElseThrow();
        events.publishEvent(PushRequested.kid(kid.getId(), "HQ wants another look", note != null && !note.isBlank() ? note : "Have another go at " + behaviours.findById(c.getBehaviourId()).map(Behaviour::getTitle).orElse("that mission"), "/hq"));
    }

    /** One approved mission per calendar day keeps the streak alive; a gap resets it. */
    void updateStreak(Kid kid, LocalDate day, Long parentId) {
        var last = kid.getStreakLastDate();
        if (day.equals(last)) return;
        if (last != null && day.equals(last.plusDays(1))) kid.setStreakDays(kid.getStreakDays() + 1);
        else if (last == null || day.isAfter(last)) kid.setStreakDays(1);
        else return;
        kid.setStreakLastDate(day);
        if (kid.getStreakDays() % 7 == 0) {
            ledger.award(kid, 25, PointEntry.Type.STREAK_BONUS, null, kid.getStreakDays() + " day streak", parentId);
            celebrations.streak(kid, kid.getStreakDays(), 25);
        }
    }
}
