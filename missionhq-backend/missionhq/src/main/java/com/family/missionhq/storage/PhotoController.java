package com.family.missionhq.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;

/** Only active with local storage: the PUT/GET targets of LocalPhotoStorage's signed URLs. */
@RestController
@RequestMapping("/api/v1/photos")
@ConditionalOnProperty(prefix = "missionhq.storage", name = "type", havingValue = "local", matchIfMissing = true)
public class PhotoController {
    private final LocalPhotoStorage storage;
    public PhotoController(PhotoStorage storage) { this.storage = (LocalPhotoStorage) storage; }

    @PutMapping("/**")
    public ResponseEntity<Void> upload(HttpServletRequest req, @RequestParam long exp, @RequestParam String sig) throws IOException {
        var key = key(req);
        if (!storage.verify("PUT", key, exp, sig)) return ResponseEntity.status(403).build();
        storage.store(key, req.getInputStream());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/**")
    public ResponseEntity<FileSystemResource> view(HttpServletRequest req, @RequestParam long exp, @RequestParam String sig) {
        var key = key(req);
        if (!storage.verify("GET", key, exp, sig)) return ResponseEntity.status(403).build();
        var path = storage.resolve(key);
        if (!Files.exists(path)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).cacheControl(CacheControl.noStore()).body(new FileSystemResource(path));
    }

    private static String key(HttpServletRequest req) {
        return req.getRequestURI().substring(req.getContextPath().length() + "/api/v1/photos/".length());
    }
}
