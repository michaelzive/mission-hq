package com.family.missionhq.storage;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

/**
 * Dev implementation: files on disk, served by PhotoController. URLs carry an HMAC signature and expiry
 * so the endpoints can stay unauthenticated, mirroring how presigned S3 URLs behave.
 */
public class LocalPhotoStorage implements PhotoStorage {
    private final Path dir;
    private final String baseUrl;
    private final byte[] secret;

    public LocalPhotoStorage(StorageProperties p) {
        this.dir = Path.of(p.local().dir()).toAbsolutePath();
        this.baseUrl = p.local().publicBaseUrl();
        this.secret = p.signingSecret().getBytes(StandardCharsets.UTF_8);
        try { Files.createDirectories(dir); } catch (IOException e) { throw new IllegalStateException(e); }
    }

    @Override
    public UploadTicket presignUpload(String key, String contentType, Duration ttl) {
        return new UploadTicket(key, signedUrl("PUT", key, ttl), "PUT", Map.of("Content-Type", contentType));
    }

    @Override public String presignView(String key, Duration ttl) { return signedUrl("GET", key, ttl); }

    @Override public void delete(String key) { try { Files.deleteIfExists(resolve(key)); } catch (IOException ignored) {} }

    /* ---- used by PhotoController ---- */
    public void store(String key, InputStream in) throws IOException {
        var target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
    }
    public Path resolve(String key) {
        var p = dir.resolve(key).normalize();
        if (!p.startsWith(dir)) throw new IllegalArgumentException("bad key");
        return p;
    }
    public boolean verify(String method, String key, long exp, String sig) {
        return exp > Instant.now().getEpochSecond() && sign(method, key, exp).equals(sig);
    }

    private String signedUrl(String method, String key, Duration ttl) {
        long exp = Instant.now().plus(ttl).getEpochSecond();
        return baseUrl + "/api/v1/photos/" + key + "?exp=" + exp + "&sig=" + sign(method, key, exp);
    }
    private String sign(String method, String key, long exp) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((method + "\n" + key + "\n" + exp).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
