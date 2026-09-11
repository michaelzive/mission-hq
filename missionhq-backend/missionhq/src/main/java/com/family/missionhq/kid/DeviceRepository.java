package com.family.missionhq.kid;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface DeviceRepository extends JpaRepository<Device, Long> {
    Optional<Device> findByDeviceToken(String token);
    Optional<Device> findByPairingCodeAndDeviceTokenIsNull(String code);
}
