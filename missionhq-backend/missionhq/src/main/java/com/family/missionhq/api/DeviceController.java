package com.family.missionhq.api;

import com.family.missionhq.kid.DeviceService;
import com.family.missionhq.kid.KidRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController @RequestMapping("/api/v1/devices") @RequiredArgsConstructor
public class DeviceController {
    private final DeviceService devices;
    private final KidRepository kids;

    public record PairRequest(String pairingCode) {}

    @PostMapping("/pair")
    public Map<String, Object> pair(@RequestBody PairRequest body) {
        var d = devices.pair(body.pairingCode());
        var kid = kids.findById(d.getKidId()).orElseThrow();
        return Map.of("deviceToken", d.getDeviceToken(), "kidId", kid.getId(), "callsign", kid.getCallsign(), "themeCode", kid.getThemeCode());
    }
}
