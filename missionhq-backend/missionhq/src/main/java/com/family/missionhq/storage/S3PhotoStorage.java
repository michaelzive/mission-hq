package com.family.missionhq.storage;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

/** Cloudflare R2, OCI Object Storage (S3 compatibility API) or AWS S3. Path-style addressing for the compatible ones. */
public class S3PhotoStorage implements PhotoStorage {
    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;

    public S3PhotoStorage(StorageProperties.S3 p) {
        var creds = StaticCredentialsProvider.create(AwsBasicCredentials.create(p.accessKey(), p.secretKey()));
        var region = Region.of(p.region());
        var cfg = S3Configuration.builder().pathStyleAccessEnabled(true).build();
        var cb = S3Client.builder().credentialsProvider(creds).region(region).serviceConfiguration(cfg);
        var pb = S3Presigner.builder().credentialsProvider(creds).region(region).serviceConfiguration(cfg);
        if (p.endpoint() != null && !p.endpoint().isBlank()) { cb.endpointOverride(URI.create(p.endpoint())); pb.endpointOverride(URI.create(p.endpoint())); }
        this.client = cb.build();
        this.presigner = pb.build();
        this.bucket = p.bucket();
    }

    @Override
    public UploadTicket presignUpload(String key, String contentType, Duration ttl) {
        var req = PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build();
        var url = presigner.presignPutObject(PutObjectPresignRequest.builder().putObjectRequest(req).signatureDuration(ttl).build()).url().toString();
        return new UploadTicket(key, url, "PUT", Map.of("Content-Type", contentType));
    }

    @Override
    public String presignView(String key, Duration ttl) {
        var req = GetObjectRequest.builder().bucket(bucket).key(key).build();
        return presigner.presignGetObject(GetObjectPresignRequest.builder().getObjectRequest(req).signatureDuration(ttl).build()).url().toString();
    }

    @Override public void delete(String key) { client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build()); }
}
