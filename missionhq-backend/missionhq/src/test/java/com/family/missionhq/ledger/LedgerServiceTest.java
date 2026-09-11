package com.family.missionhq.ledger;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LedgerServiceTest {
    PointEntryRepository entries = mock(PointEntryRepository.class);
    KidRepository kids = mock(KidRepository.class);
    ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    LedgerService ledger = new LedgerService(entries, kids, events);
    Kid kid = new Kid();

    @BeforeEach void setup() { kid.setId(1L); when(entries.save(any())).thenAnswer(i -> i.getArgument(0)); }

    @Test void awardRaisesBalanceAndLifetimeAndPublishes() {
        ledger.award(kid, 20, PointEntry.Type.MISSION, 7L, "Homework", 1L);
        assertThat(kid.getBalance()).isEqualTo(20);
        assertThat(kid.getLifetimeEarned()).isEqualTo(20);
        verify(events).publishEvent(new PointsAwarded(1L, 20, 20));
    }

    @Test void spendLowersBalanceOnly() {
        ledger.award(kid, 100, PointEntry.Type.MISSION, null, null, 1L);
        ledger.spend(kid, 40, 9L);
        assertThat(kid.getBalance()).isEqualTo(60);
        assertThat(kid.getLifetimeEarned()).isEqualTo(100);
    }

    @Test void cannotSpendMoreThanBalance() {
        assertThatThrownBy(() -> ledger.spend(kid, 1, 9L)).isInstanceOf(DomainException.class);
    }

    @Test void negativeAwardRejected() {
        assertThatThrownBy(() -> ledger.award(kid, -5, PointEntry.Type.BONUS, null, null, 1L)).isInstanceOf(DomainException.class);
    }
}
