package com.family.missionhq.storage;

import java.time.Duration;
import java.util.Map;

/**
 * Where mission photos live. Spring never handles image bytes: the kid app PUTs straight to the upload URL,
 * the parent app GETs straight from the view URL. Implementations: local disk (dev) and S3-compatible (R2 / OCI).
 */
public interface PhotoStorage {
    record UploadTicket(String key, String url, String method, Map<String, String> headers) {}

    UploadTicket presignUpload(String key, String contentType, Duration ttl);
    String presignView(String key, Duration ttl);
    void delete(String key);
}
