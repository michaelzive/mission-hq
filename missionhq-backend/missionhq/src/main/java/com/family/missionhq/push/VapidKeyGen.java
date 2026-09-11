package com.family.missionhq.push;

import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Security;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

/** One-off: prints a VAPID key pair for VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. */
public class VapidKeyGen {
    public static void main(String[] args) throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        var gen = KeyPairGenerator.getInstance("ECDH", "BC");
        gen.initialize(new ECGenParameterSpec("secp256r1"), new SecureRandom());
        KeyPair kp = gen.generateKeyPair();
        var enc = Base64.getUrlEncoder().withoutPadding();
        System.out.println("VAPID_PUBLIC_KEY=" + enc.encodeToString(Utils.encode((ECPublicKey) kp.getPublic())));
        System.out.println("VAPID_PRIVATE_KEY=" + enc.encodeToString(Utils.encode((ECPrivateKey) kp.getPrivate())));
    }
}
