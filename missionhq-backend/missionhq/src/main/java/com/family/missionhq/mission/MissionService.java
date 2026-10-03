package com.family.missionhq.mission;

import com.family.missionhq.celebration.CelebrationService;
import com.family.missionhq.common.DomainException;
import com.family.missionhq.household.HouseholdClock;
import com.family.missionhq.household.HouseholdRepository;
import com.family.missionhq.household.Parent;
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

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service @RequiredArgsConstructor
public class MissionService {
    private final MissionCompletionRepository completions;
    private final BehaviourRepository behaviours;
    private final KidRepository kids;
    private final HouseholdRepository households;
    private final LedgerService ledger;
    private final CelebrationService celebrations;
    private final StreakService streaks;
    private final HouseholdClock clock;
    private final PhotoStorage photos;
    private final ApplicationEventPublisher events;

    /**
     * {@code forMe}: directed at this kid alone rather than everyone in the household. {@code weekly}: once a week, so
     * it stays done until Monday. {@code loggedByParent}/{@code pointsAwarded} explain an APPROVED card that paid less.
     */
    public record MissionCard(Long behaviourId, String title, int points, boolean bonus, boolean weekly, boolean requiresPhoto,
                              String status, boolean forMe, boolean loggedByParent, Integer pointsAwarded) {}

    @Transactional(readOnly = true)
    public List<MissionCard> cardsFor(Kid kid, LocalDate date) {
        var week = completions.findByKidIdAndMissionDateBetween(kid.getId(), date.with(DayOfWeek.MONDAY), date.with(DayOfWeek.SUNDAY));
        return behaviours.findByHouseholdIdAndActiveTrue(kid.getHouseholdId()).stream()
                .filter(b -> b.visibleOn(date) && b.isFor(kid.getId()))
                .map(b -> {
                    var c = standing(week.stream().filter(x -> x.getBehaviourId().equals(b.getId()) && inPeriod(b, date, x.getMissionDate())).toList());
                    var status = c.map(x -> x.getStatus() == MissionCompletion.Status.SENT_BACK ? "TODO" : x.getStatus().name()).orElse("TODO");
                    return new MissionCard(b.getId(), b.getTitle(), b.getPoints(), b.getKind() == Behaviour.Kind.BONUS, b.getKind() == Behaviour.Kind.WEEKLY,
                            b.isRequiresPhoto(), status, b.getKidId() != null, c.map(MissionCompletion::isLoggedByParent).orElse(false),
                            c.map(MissionCompletion::getPointsAwarded).orElse(null));
                }).toList();
    }

    /** Presigned upload ticket. Key is deterministic per kid/behaviour/day so a retry overwrites rather than orphans. */
    @Transactional(readOnly = true)
    public PhotoStorage.UploadTicket photoTicket(Kid kid, Long behaviourId, LocalDate date) {
        reportable(kid, date);
        available(kid, behaviourId, date);
        var key = "missions/" + kid.getId() + "/" + date + "/" + behaviourId + ".jpg";
        return photos.presignUpload(key, "image/jpeg", java.time.Duration.ofMinutes(10));
    }

    /**
     * A kid reports a mission for today, or for yesterday while the late window is open. A mission that needs no photo
     * is trusted and approved on the spot; anything with a photo waits for a parent.
     */
    @Transactional
    public MissionCompletion submit(Kid kid, Long behaviourId, LocalDate date, String photoKey) {
        reportable(kid, date);
        var b = available(kid, behaviourId, date);
        if (b.isRequiresPhoto() && (photoKey == null || photoKey.isBlank())) throw DomainException.badRequest("photo required");
        var c = openSlot(kid, b, date);
        c.setStatus(MissionCompletion.Status.PENDING);
        c.setNote(null);
        c.setPhotoKey(photoKey);
        c.setSubmittedAt(Instant.now());
        var saved = completions.save(c);
        if (!b.isRequiresPhoto()) {
            pay(saved, kid, b, null, b.getPoints(), 0);
            return saved;
        }
        events.publishEvent(PushRequested.parents(kid.getHouseholdId(), "Mission report from " + kid.getCallsign(), b.getTitle() + " · " + b.getPoints() + " pts, waiting for your OK", "/approvals"));
        return saved;
    }

    @Transactional
    public void approve(Long completionId, Parent parent, int extraBonus) {
        var c = pendingFor(parent, completionId);
        var b = behaviours.findById(c.getBehaviourId()).orElseThrow();
        var kid = kids.findById(c.getKidId()).orElseThrow();
        pay(c, kid, b, parent.getId(), b.getPoints(), extraBonus);
    }

    /**
     * A parent saw it done. If the kid already reported it, that report is approved at full points; otherwise it is
     * logged at the household's parent-log rate and doesn't count toward the streak, so reporting it yourself pays more.
     * Parents may log today or yesterday, with no late-window cutoff.
     */
    @Transactional
    public MissionCompletion logForKid(Parent parent, Kid kid, Long behaviourId, LocalDate date) {
        var today = clock.today(kid.getHouseholdId());
        if (!date.equals(today) && !date.equals(today.minusDays(1))) throw DomainException.badRequest("missions can be logged for today or yesterday");
        var b = available(kid, behaviourId, date);
        var reported = inPeriod(kid, b, date).stream().filter(x -> x.getStatus() == MissionCompletion.Status.PENDING).findFirst();
        if (reported.isPresent()) {
            pay(reported.get(), kid, b, parent.getId(), b.getPoints(), 0);
            return reported.get();
        }
        var c = openSlot(kid, b, date);
        var hh = households.findById(kid.getHouseholdId()).orElseThrow();
        int points = hh.parentLogPoints(b.getPoints());
        c.setLoggedByParent(true);
        c.setNote(null);
        c.setSubmittedAt(Instant.now());
        var saved = completions.save(c);
        pay(saved, kid, b, parent.getId(), points, 0);
        events.publishEvent(PushRequested.kid(kid.getId(), "HQ logged a mission for you", b.getTitle() + " · +" + points + " pts. Report it yourself for the full +" + b.getPoints(), "/hq"));
        return saved;
    }

    @Transactional
    public void sendBack(Long completionId, Parent parent, String note) {
        var c = pendingFor(parent, completionId);
        c.setStatus(MissionCompletion.Status.SENT_BACK);
        c.setReviewedAt(Instant.now());
        c.setReviewedBy(parent.getId());
        c.setNote(note);
        if (c.getPhotoKey() != null) photos.delete(c.getPhotoKey());
        c.setPhotoKey(null);
        var kid = kids.findById(c.getKidId()).orElseThrow();
        events.publishEvent(PushRequested.kid(kid.getId(), "HQ wants another look", note != null && !note.isBlank() ? note : "Have another go at " + behaviours.findById(c.getBehaviourId()).map(Behaviour::getTitle).orElse("that mission"), "/hq"));
    }

    /** Approve and pay out. reviewer null = approved automatically. Parent-logged missions leave the streak alone. */
    private void pay(MissionCompletion c, Kid kid, Behaviour b, Long reviewer, int points, int extraBonus) {
        c.setStatus(MissionCompletion.Status.APPROVED);
        c.setReviewedAt(Instant.now());
        c.setReviewedBy(reviewer);
        c.setPointsAwarded(points);
        ledger.award(kid, points, PointEntry.Type.MISSION, c.getId(), b.getTitle(), reviewer);
        celebrations.missionApproved(kid, c.getId(), points, b.getId());
        if (extraBonus > 0) {
            ledger.award(kid, extraBonus, PointEntry.Type.BONUS, c.getId(), "HQ impressed", reviewer);
            celebrations.bonus(kid, extraBonus, "HQ impressed");
        }
        if (c.isLoggedByParent()) return;   // the caller sends its own push; the streak is for missions the kid reported
        streaks.afterApproval(kid, reviewer);
        if (reviewer != null) events.publishEvent(PushRequested.kid(kid.getId(), "HQ has news for you", b.getTitle() + " confirmed. Open HQ to collect.", "/hq"));
    }

    private void reportable(Kid kid, LocalDate date) {
        if (!clock.kidMayReport(kid.getHouseholdId(), date)) throw DomainException.badRequest("that day can no longer be reported");
    }

    /**
     * The row to (re)use for a new report in this mission's period: a sent-back one is reused (moved to the new date),
     * a pending or approved one means it's already done.
     */
    private MissionCompletion openSlot(Kid kid, Behaviour b, LocalDate date) {
        var existing = standing(inPeriod(kid, b, date));
        if (existing.isPresent() && existing.get().getStatus() != MissionCompletion.Status.SENT_BACK)
            throw DomainException.conflict(b.getKind() == Behaviour.Kind.WEEKLY ? "already done this week" : "already submitted today");
        var c = existing.orElseGet(MissionCompletion::new);
        c.setKidId(kid.getId());
        c.setBehaviourId(b.getId());
        c.setMissionDate(date);
        return c;
    }

    private List<MissionCompletion> inPeriod(Kid kid, Behaviour b, LocalDate date) {
        return completions.findByKidIdAndBehaviourIdAndMissionDateBetween(kid.getId(), b.getId(), b.periodStart(date), b.periodEnd(date));
    }

    private static boolean inPeriod(Behaviour b, LocalDate date, LocalDate missionDate) {
        return !missionDate.isBefore(b.periodStart(date)) && !missionDate.isAfter(b.periodEnd(date));
    }

    /** The completion that decides a card: approved beats pending beats sent back. */
    private static Optional<MissionCompletion> standing(List<MissionCompletion> inPeriod) {
        return inPeriod.stream().min(Comparator.comparingInt(c -> switch (c.getStatus()) { case APPROVED -> 0; case PENDING -> 1; case SENT_BACK -> 2; }));
    }

    /** The mission as this kid may do it on that date: same household, live on that date, and for everyone or for them. */
    private Behaviour available(Kid kid, Long behaviourId, LocalDate date) {
        var b = behaviours.findById(behaviourId).orElseThrow(() -> DomainException.notFound("behaviour"));
        if (!b.getHouseholdId().equals(kid.getHouseholdId()) || !b.visibleOn(date) || !b.isFor(kid.getId()))
            throw DomainException.badRequest("mission not available today");
        return b;
    }

    /** A completion in another household reads as not found so ids never leak across families. */
    private MissionCompletion pendingFor(Parent parent, Long completionId) {
        var c = completions.findById(completionId)
                .filter(x -> kids.findById(x.getKidId()).map(k -> k.getHouseholdId().equals(parent.getHouseholdId())).orElse(false))
                .orElseThrow(() -> DomainException.notFound("completion"));
        if (c.getStatus() != MissionCompletion.Status.PENDING) throw DomainException.conflict("not pending");
        return c;
    }
}
