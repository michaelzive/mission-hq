package com.family.missionhq.rank;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RankDefinitionRepository extends JpaRepository<RankDefinition, RankDefinition.Key> {
    List<RankDefinition> findByThemeCodeOrderByOrdinalAsc(String themeCode);
}
