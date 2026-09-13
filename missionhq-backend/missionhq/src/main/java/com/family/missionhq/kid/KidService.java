package com.family.missionhq.kid;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.rank.RankDefinitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class KidService {
    private final KidRepository kids;
    private final RankDefinitionRepository ranks;

    @Transactional
    public Kid create(Long householdId, String callsign, String themeCode) {
        var kid = new Kid();
        kid.setHouseholdId(householdId);
        apply(kid, callsign, themeCode);
        return kids.save(kid);
    }

    @Transactional
    public Kid update(Kid kid, String callsign, String themeCode) {
        apply(kid, callsign, themeCode);
        return kids.save(kid);
    }

    private void apply(Kid kid, String callsign, String themeCode) {
        var name = callsign == null ? "" : callsign.trim();
        if (name.isEmpty() || name.length() > 20) throw DomainException.badRequest("callsign must be 1-20 characters");
        if (ranks.findByThemeCodeOrderByOrdinalAsc(themeCode).isEmpty()) throw DomainException.badRequest("unknown world");
        kid.setCallsign(name);
        kid.setThemeCode(themeCode);
    }
}
