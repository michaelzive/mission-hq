package com.family.missionhq.cosmetic;

import com.family.missionhq.common.DomainException;
import com.family.missionhq.kid.Kid;
import com.family.missionhq.kid.KidRepository;
import com.family.missionhq.ledger.LedgerService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service @RequiredArgsConstructor
public class CosmeticService {
    private final CosmeticItemRepository items;
    private final KidCosmeticRepository owned;
    private final AvatarRepository avatars;
    private final KidRepository kids;
    private final LedgerService ledger;
    private final ObjectMapper json;

    public enum State { OWNED, BUYABLE, LOCKED }
    public record CatalogueItem(Long id, String slot, String name, String assetKey, int price, int unlockRankOrdinal, State state, boolean equipped) {}
    public record AvatarView(int colour, Map<String, String> slots) {}

    @Transactional(readOnly = true)
    public List<CatalogueItem> catalogue(Kid kid) {
        var ownedIds = owned.findByKidId(kid.getId()).stream().map(KidCosmetic::getCosmeticItemId).collect(java.util.stream.Collectors.toSet());
        var slots = avatar(kid).slots();
        return items.findByThemeCodeOrderBySlotAscPriceAsc(kid.getThemeCode()).stream().map(i -> {
            State s = (i.isStarter() || ownedIds.contains(i.getId())) ? State.OWNED
                    : kid.getRankOrdinal() >= i.getUnlockRankOrdinal() ? State.BUYABLE : State.LOCKED;
            boolean equipped = i.getAssetKey().equals(slots.get(i.getSlot()));
            return new CatalogueItem(i.getId(), i.getSlot(), i.getName(), i.getAssetKey(), i.getPrice(), i.getUnlockRankOrdinal(), s, equipped);
        }).toList();
    }

    @Transactional
    public CatalogueItem buy(Kid kid, Long itemId) {
        var i = items.findById(itemId).orElseThrow(() -> DomainException.notFound("item"));
        if (!i.getThemeCode().equals(kid.getThemeCode())) throw DomainException.badRequest("not in your world");
        if (kid.getRankOrdinal() < i.getUnlockRankOrdinal()) throw DomainException.conflict("locked until a higher rank");
        if (i.isStarter() || owned.existsById(new KidCosmetic.Key(kid.getId(), itemId))) throw DomainException.conflict("already owned");
        if (i.getPrice() > 0) ledger.spend(kid, i.getPrice(), null);
        grant(kid, i);
        equip(kid, itemId);
        return catalogue(kid).stream().filter(c -> c.id().equals(itemId)).findFirst().orElseThrow();
    }

    /** Rank-up hook: everything free at this rank goes straight into the locker. */
    @Transactional
    public List<CosmeticItem> grantRankUnlocks(Kid kid, int rankOrdinal) {
        var unlocked = items.findByThemeCodeAndUnlockRankOrdinalAndPrice(kid.getThemeCode(), rankOrdinal, 0);
        unlocked.forEach(i -> grant(kid, i));
        return unlocked;
    }

    @Transactional
    public AvatarView equip(Kid kid, Long itemId) {
        var i = items.findById(itemId).orElseThrow(() -> DomainException.notFound("item"));
        if (!(i.isStarter() || owned.existsById(new KidCosmetic.Key(kid.getId(), itemId)))) throw DomainException.forbidden("you do not own that");
        var a = avatarEntity(kid);
        var slots = readSlots(a);
        if (i.getAssetKey().equals(slots.get(i.getSlot()))) slots.remove(i.getSlot()); else slots.put(i.getSlot(), i.getAssetKey());
        writeSlots(a, slots);
        return new AvatarView(a.getColour(), slots);
    }

    @Transactional
    public AvatarView setColour(Kid kid, int colour) {
        var a = avatarEntity(kid);
        a.setColour(Math.max(0, Math.min(7, colour)));
        return new AvatarView(a.getColour(), readSlots(a));
    }

    @Transactional(readOnly = true)
    public AvatarView avatar(Kid kid) {
        return avatars.findById(kid.getId()).map(a -> new AvatarView(a.getColour(), readSlots(a))).orElse(new AvatarView(0, Map.of()));
    }

    private void grant(Kid kid, CosmeticItem i) {
        if (i.isStarter() || owned.existsById(new KidCosmetic.Key(kid.getId(), i.getId()))) return;
        var kc = new KidCosmetic(); kc.setKidId(kid.getId()); kc.setCosmeticItemId(i.getId()); owned.save(kc);
    }
    private Avatar avatarEntity(Kid kid) {
        return avatars.findById(kid.getId()).orElseGet(() -> { var a = new Avatar(); a.setKidId(kid.getId()); return avatars.save(a); });
    }
    private Map<String, String> readSlots(Avatar a) {
        try { return json.readValue(a.getSlots() == null ? "{}" : a.getSlots(), new TypeReference<LinkedHashMap<String, String>>() {}); }
        catch (Exception e) { return new LinkedHashMap<>(); }
    }
    private void writeSlots(Avatar a, Map<String, String> slots) {
        try { a.setSlots(json.writeValueAsString(slots)); } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
