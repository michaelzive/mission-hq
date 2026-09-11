package com.family.missionhq.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {
    @Bean
    @ConditionalOnProperty(prefix = "missionhq.storage", name = "type", havingValue = "local", matchIfMissing = true)
    PhotoStorage localPhotoStorage(StorageProperties p) { return new LocalPhotoStorage(p); }

    @Bean
    @ConditionalOnProperty(prefix = "missionhq.storage", name = "type", havingValue = "s3")
    PhotoStorage s3PhotoStorage(StorageProperties p) { return new S3PhotoStorage(p.s3()); }
}
