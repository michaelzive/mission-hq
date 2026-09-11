package com.family.missionhq.push;

/** Published inside a transaction; delivered by PushService only after that transaction commits. */
public record PushRequested(PushSubscription.OwnerType to, Long ownerId, String title, String body, String url) {
    public static PushRequested kid(Long kidId, String title, String body, String url) { return new PushRequested(PushSubscription.OwnerType.KID, kidId, title, body, url); }
    public static PushRequested parents(String title, String body, String url) { return new PushRequested(PushSubscription.OwnerType.PARENT, null, title, body, url); }
}
