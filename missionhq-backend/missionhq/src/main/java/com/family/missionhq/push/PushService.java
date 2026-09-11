package com.family.missionhq.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.security.Security;
import java.util.List;
import java.util.Map;

/**
 * Sends Web Push notifications in the payload shape the Angular service worker (ngsw) understands,
 * so a tap on the notification opens the right screen. Sending is async and after-commit: a rolled-back
 * approval never pings anyone, and a slow push endpoint never slows an approval.
 */
@Service @Slf4j
public class PushService {
    private final PushSubscriptionRepository subs;
    private final ObjectMapper json;
    private final nl.martijndwars.webpush.PushService client;
    private final boolean enabled;

    public PushService(PushSubscriptionRepository subs, ObjectMapper json,
                       @Value("${missionhq.push.public-key}") String publicKey,
                       @Value("${missionhq.push.private-key}") String privateKey,
                       @Value("${missionhq.push.subject}") String subject) throws Exception {
        this.subs = subs; this.json = json;
        this.enabled = publicKey != null && !publicKey.isBlank();
        if (Security.getProvider("BC") == null) Security.addProvider(new BouncyCastleProvider());
        this.client = enabled ? new nl.martijndwars.webpush.PushService(publicKey, privateKey, subject) : null;
        if (!enabled) log.warn("Push disabled: missionhq.push.public-key not set");
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(PushRequested ev) {
        if (!enabled) return;
        List<PushSubscription> targets = ev.ownerId() == null ? subs.findByOwnerType(ev.to()) : subs.findByOwnerTypeAndOwnerId(ev.to(), ev.ownerId());
        for (var s : targets) send(s, ev);
    }

    private void send(PushSubscription s, PushRequested ev) {
        try {
            var payload = json.writeValueAsString(Map.of("notification", Map.of(
                    "title", ev.title(), "body", ev.body(), "icon", "icons/icon-192x192.png", "badge", "icons/icon-72x72.png",
                    "tag", ev.url(), "renotify", true, "vibrate", List.of(100, 50, 100),
                    "data", Map.of("onActionClick", Map.of("default", Map.of("operation", "navigateLastFocusedOrOpen", "url", ev.url()))))));
            var sub = new Subscription(s.getEndpoint(), new Subscription.Keys(s.getP256dh(), s.getAuth()));
            var res = client.send(new Notification(sub, payload));
            int code = res.getStatusLine().getStatusCode();
            if (code == 404 || code == 410) { subs.delete(s); log.info("Removed stale push subscription {}", s.getId()); }
            else if (code >= 300) log.warn("Push to {} returned {}", s.getId(), code);
        } catch (Exception e) {
            log.warn("Push to {} failed: {}", s.getId(), e.getMessage());
        }
    }
}
