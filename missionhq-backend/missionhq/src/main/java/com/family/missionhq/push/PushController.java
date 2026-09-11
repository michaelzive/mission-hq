package com.family.missionhq.push;

import com.family.missionhq.security.CurrentKid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController @RequestMapping("/api/v1") @RequiredArgsConstructor
public class PushController {
    private static final Long PARENT_ID = 1L;
    private final PushSubscriptionRepository subs;
    private final CurrentKid current;
    @Value("${missionhq.push.public-key}") private String publicKey;

    public record SubscriptionRequest(String endpoint, Keys keys) { public record Keys(String p256dh, String auth) {} }

    /** Unauthenticated: the app needs the key before it can subscribe. */
    @GetMapping("/push/public-key")
    public Map<String, String> publicKey() { return Map.of("publicKey", publicKey == null ? "" : publicKey); }

    @PostMapping("/me/push/subscribe")
    public void subscribeKid(@RequestBody SubscriptionRequest body) { save(PushSubscription.OwnerType.KID, current.get().getId(), body); }

    @DeleteMapping("/me/push/subscribe")
    public void unsubscribeKid(@RequestBody SubscriptionRequest body) { subs.findByEndpoint(body.endpoint()).ifPresent(subs::delete); }

    @PostMapping("/push/subscribe")
    public void subscribeParent(@RequestBody SubscriptionRequest body) { save(PushSubscription.OwnerType.PARENT, PARENT_ID, body); }

    @DeleteMapping("/push/subscribe")
    public void unsubscribeParent(@RequestBody SubscriptionRequest body) { subs.findByEndpoint(body.endpoint()).ifPresent(subs::delete); }

    private void save(PushSubscription.OwnerType type, Long ownerId, SubscriptionRequest body) {
        var s = subs.findByEndpoint(body.endpoint()).orElseGet(PushSubscription::new);
        s.setOwnerType(type); s.setOwnerId(ownerId); s.setEndpoint(body.endpoint());
        s.setP256dh(body.keys().p256dh()); s.setAuth(body.keys().auth());
        subs.save(s);
    }
}
