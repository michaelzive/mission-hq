package com.family.missionhq.cosmetic;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface KidCosmeticRepository extends JpaRepository<KidCosmetic, KidCosmetic.Key> {
    List<KidCosmetic> findByKidId(Long kidId);
}
