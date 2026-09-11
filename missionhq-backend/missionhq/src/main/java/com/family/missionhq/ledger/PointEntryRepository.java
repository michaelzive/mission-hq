package com.family.missionhq.ledger;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PointEntryRepository extends JpaRepository<PointEntry, Long> {
    List<PointEntry> findByKidIdOrderByCreatedAtDesc(Long kidId);

    @Query("select coalesce(sum(p.points),0) from PointEntry p where p.kidId = :kidId")
    int balanceOf(Long kidId);

    @Query("select coalesce(sum(p.points),0) from PointEntry p where p.kidId = :kidId and p.points > 0")
    int lifetimeOf(Long kidId);

    @Query("select coalesce(sum(p.points),0) from PointEntry p join Kid k on k.id = p.kidId where k.householdId = :householdId and p.points > 0")
    int householdLifetime(Long householdId);
}
