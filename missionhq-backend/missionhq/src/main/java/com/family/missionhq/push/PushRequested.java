package com.family.missionhq.push;

/** Published inside a transaction; delivered by PushService only after that transaction commits. */
public record PushRequested(PushSubscription.OwnerType to, Long ownerId, Long householdId, String title, String body, String url) {
    public static PushRequested kid(Long kidId, String title, String body, String url) { return new PushRequested(PushSubscription.OwnerType.KID, kidId, null, title, body, url); }
    /** Every parent of one household. */
    public static PushRequested parents(Long householdId, String title, String body, String url) { return new PushRequested(PushSubscription.OwnerType.PARENT, null, householdId, title, body, url); }
}
