package com.family.missionhq.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "missionhq.storage")
public record StorageProperties(String type, int photoTtlDays, String signingSecret, Local local, S3 s3) {
    public record Local(String dir, String publicBaseUrl) {}
    public record S3(String endpoint, String region, String bucket, String accessKey, String secretKey) {}
}
