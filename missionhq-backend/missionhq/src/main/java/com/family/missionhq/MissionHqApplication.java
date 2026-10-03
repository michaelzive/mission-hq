package com.family.missionhq;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class MissionHqApplication {
    public static void main(String[] args) { SpringApplication.run(MissionHqApplication.class, args); }

    /** Injected wherever "now" matters, so tests can pin it. Household-local time comes from HouseholdClock. */
    @Bean Clock clock() { return Clock.systemUTC(); }
}
