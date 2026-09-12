package com.family.missionhq.push;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByOwnerTypeAndOwnerId(PushSubscription.OwnerType type, Long ownerId);
    List<PushSubscription> findByOwnerTypeAndOwnerIdIn(PushSubscription.OwnerType type, Collection<Long> ownerIds);
    Optional<PushSubscription> findByEndpoint(String endpoint);
}
