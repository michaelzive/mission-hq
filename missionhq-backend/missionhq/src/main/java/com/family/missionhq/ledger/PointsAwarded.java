package com.family.missionhq.ledger;

/** Published after every positive ledger write. RankService listens. */
public record PointsAwarded(Long kidId, int points, int lifetimeAfter) {}
