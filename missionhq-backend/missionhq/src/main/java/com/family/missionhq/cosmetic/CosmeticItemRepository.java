package com.family.missionhq.cosmetic;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CosmeticItemRepository extends JpaRepository<CosmeticItem, Long> {
    List<CosmeticItem> findByThemeCodeOrderBySlotAscPriceAsc(String themeCode);
    List<CosmeticItem> findByThemeCodeAndUnlockRankOrdinalAndPrice(String themeCode, int unlockRankOrdinal, int price);
}
