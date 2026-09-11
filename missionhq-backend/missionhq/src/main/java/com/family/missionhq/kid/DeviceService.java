package com.family.missionhq.kid;

import com.family.missionhq.common.DomainException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;

@Service @RequiredArgsConstructor
public class DeviceService {
    private final DeviceRepository devices;
    private final KidRepository kids;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public String createPairingCode(Long kidId) {
        kids.findById(kidId).orElseThrow(() -> DomainException.notFound("kid"));
        var d = new Device();
        d.setKidId(kidId);
        d.setPairingCode(String.format("%06d", random.nextInt(1_000_000)));
        devices.save(d);
        return d.getPairingCode();
    }

    /** Tablet enters the code once; from then on it sends the returned token. */
    @Transactional
    public Device pair(String code) {
        var d = devices.findByPairingCodeAndDeviceTokenIsNull(code)
                .orElseThrow(() -> DomainException.badRequest("pairing code invalid or already used"));
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        d.setDeviceToken(HexFormat.of().formatHex(bytes));
        d.setPairedAt(Instant.now());
        d.setPairingCode(null);
        return d;
    }
}
