"""
Turns a rigged, animated Meshy .glb into a character the avatar stage can use (see
projects/kid/src/app/shared/avatar3d/ASSETS.md): renames the moves, adds the gear sockets, shrinks the textures,
makes the colour-region mask and exports. Runs headless in a fresh Blender, so it never touches an open scene:

  blender --background --factory-startup --python scripts/avatar/prepare_character.py -- \
      --src ~/Downloads/Meshy_AI_knight.glb --id knight

Moves are guessed from Meshy's clip names; pin any with --clip celebrate=Backflip. Region colours are guessed from
the texture's most common colours (printed, so a bad guess is easy to spot); pin them with --region main=#f2f2f2.
Sockets are placed from the body's measurements; nudge one with --nudge head=up:0.02,scale:1.2 (metres, from the
character's point of view: right/up/forward).
"""
import argparse
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

CLIPS = ("idle", "wave", "cheer", "dance", "celebrate")
# Searched in order, case-insensitively, against Meshy's clip names.
CLIP_GUESSES = {
    "idle": ("idle",),
    "wave": ("wave",),
    "cheer": ("cheer",),
    "dance": ("danc",),
    "celebrate": ("celebrat", "jump", "flip", "spin"),
}
REGIONS = ("main", "trim", "accent")
MAX_TEXTURE = 1024
MASK_SIZE = 512
MASK_LEVELS = 4  # 5 grey steps: soft edges, but a PNG that compresses to ~100 KB
# Colour distance (CIELAB, lightness down-weighted so shading stays inside a region): full member below, out above.
REGION_NEAR, REGION_FAR, LIGHTNESS_WEIGHT = 10.0, 18.0, 0.35

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, "..", "..", "projects", "kid", "public", "avatars", "3d"))
DEFAULT_BLEND_DIR = os.path.join(os.path.expanduser("~"), "Documents", "MissionHQ avatars")


def main():
    args = parse_args()
    if not bpy.app.background:
        sys.exit("Run this with blender --background; it starts from an empty file and would discard an open scene.")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.src)
    arm = next((o for o in bpy.context.scene.objects if o.type == "ARMATURE"), None)
    if not arm:
        sys.exit("No armature in the file: rig the character in Meshy first.")
    meshes = [o for o in arm.children_recursive if o.type == "MESH"]

    clips = pick_clips(arm, args.clip)
    shrink_textures(meshes)
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    sockets = add_sockets(arm, meshes, args.nudge)
    mask = None if args.no_mask else make_mask(arm, meshes, args.region, os.path.join(args.out, f"{args.id}-regions.png"))
    arm.data.pose_position = "POSE"

    glb = os.path.join(args.out, f"{args.id}.glb")
    export(arm, glb)
    os.makedirs(args.blend_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.blend_dir, f"{args.id}.blend"))
    report(args, glb, meshes, clips, sockets, mask)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="prepare_character.py")
    p.add_argument("--src", required=True, help="Meshy .glb (rigged, with animations)")
    p.add_argument("--id", required=True, help="character id, used for the file names")
    p.add_argument("--name", help="display name for the manifest snippet")
    p.add_argument("--clip", nargs="*", default=[], metavar="MOVE=CLIP")
    p.add_argument("--region", nargs="*", default=[], metavar="REGION=#RRGGBB")
    p.add_argument("--nudge", nargs="*", default=[], metavar="SOCKET=right:M,up:M,forward:M,scale:X")
    p.add_argument("--no-mask", action="store_true", help="skip the colour-region mask")
    p.add_argument("--out", default=DEFAULT_OUT)
    p.add_argument("--blend-dir", default=DEFAULT_BLEND_DIR)
    a = p.parse_args(argv)
    a.src = os.path.expanduser(a.src)
    a.clip = dict(pair(s) for s in a.clip)
    a.region = {k: hex_colour(v) for k, v in (pair(s) for s in a.region)}
    a.nudge = {k: {kk: float(vv) for kk, vv in (x.split(":") for x in v.split(","))} for k, v in (pair(s) for s in a.nudge)}
    for k in a.clip:
        if k not in CLIPS: p.error(f"unknown move {k}; expected one of {', '.join(CLIPS)}")
    for k in a.region:
        if k not in REGIONS: p.error(f"unknown region {k}; expected one of {', '.join(REGIONS)}")
    return a


# ---- moves ------------------------------------------------------------------------------------------------------

def pick_clips(arm, pinned):
    """Renames the chosen actions to the stage's move names and deletes the rest (each clip adds to the download)."""
    actions = {a.name: a for a in bpy.data.actions}
    chosen = {}
    for move in CLIPS:
        if move in pinned:
            if pinned[move] not in actions:
                sys.exit(f"--clip {move}={pinned[move]}: no such clip. Clips in the file: {', '.join(actions)}")
            chosen[move] = pinned[move]
            continue
        free = [n for n in actions if n not in chosen.values() and n not in pinned.values()]
        chosen[move] = next((n for kw in CLIP_GUESSES[move] for n in free if kw in n.lower()), None)
    ad = arm.animation_data or arm.animation_data_create()
    keep = {name: move for move, name in chosen.items() if name}
    for t in list(ad.nla_tracks):
        if t.strips and t.strips[0].action and t.strips[0].action.name in keep:
            continue
        ad.nla_tracks.remove(t)
    for name, action in actions.items():
        if name not in keep:
            bpy.data.actions.remove(action)
            continue
        move = keep[name]
        track = next((t for t in ad.nla_tracks if t.strips and t.strips[0].action == action), None)
        if not track:
            track = ad.nla_tracks.new()
            track.strips.new(move, int(action.frame_range[0]), action)
        action.name = track.name = track.strips[0].name = move
        action.use_fake_user = True
    ad.action = bpy.data.actions.get("idle")
    return chosen


# ---- textures ---------------------------------------------------------------------------------------------------

def shrink_textures(meshes):
    for img in {n.image for m in materials(meshes) for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image}:
        w, h = img.size
        if max(w, h) > MAX_TEXTURE:
            f = MAX_TEXTURE / max(w, h)
            img.scale(max(1, round(w * f)), max(1, round(h * f)))


def materials(meshes):
    return [s.material for o in meshes for s in o.material_slots if s.material and s.material.node_tree]


# ---- sockets ----------------------------------------------------------------------------------------------------

def add_sockets(arm, meshes, nudges):
    """
    Places socket_head/face/back/hand from the body's measurements. The constants are the space explorer's hand-tuned
    sockets expressed as multiples of head width (head, face) and shoulder width (back, hand), so gear modelled for
    the stage fits other proportions. World scale includes the stage's resize, which works out because the stage
    scales the whole model to 2 units tall.
    """
    mw = arm.matrix_world
    at = lambda suffix: mw @ bone(arm, suffix).head
    verts, head_w = vertices(meshes, arm)
    head = verts[head_w > 0.5]
    if not len(head):
        sys.exit("No vertices follow the Head bone; is this a Meshy humanoid rig?")
    hx = at("Head").x
    wh = np.ptp(head[:, 0])                                   # head width
    shoulders = (at("LeftArm") - at("RightArm")).length

    near_mid = head[np.abs(head[:, 0] - hx) < 0.15 * wh]
    nose = near_mid[np.argmin(near_mid[:, 1])]                 # most forward point (the character faces -Y)
    eye_z = nose[2] + 0.134 * wh
    face_band = head[(np.abs(head[:, 2] - eye_z) < 0.077 * wh) & (np.abs(head[:, 0] - hx) < 0.3 * wh)]

    back_z = at("Spine1").z
    sx = at("Spine1").x
    body = verts[head_w <= 0.5]
    back_band = body[(np.abs(body[:, 2] - back_z) < 0.05 * shoulders) & (np.abs(body[:, 0] - sx) < 0.19 * shoulders)]

    hand, middle = at("RightHand"), at("RightHandMiddle1") if has_bone(arm, "RightHandMiddle1") else mw @ bone(arm, "RightHand").tail
    along = (middle - hand)
    hand_len = along.length
    forward = Vector((0, -1, 0))
    back_of_hand = along.normalized().cross(forward).normalized()
    if back_of_hand.z < 0:
        back_of_hand = -back_of_hand
    # Gear axes in Blender terms: glTF +Y (along a held item) is local +Z here, glTF +Z is local -Y.
    zx = forward
    yx = -back_of_hand
    hand_rot = Matrix((yx.cross(zx), yx, zx)).transposed()

    specs = {
        "head": ("Head", Vector((hx, (head[:, 1].min() + head[:, 1].max()) / 2, head[:, 2].max() - 0.23 * wh)), Matrix.Identity(3), 1.95 * wh),
        "face": ("Head", Vector((hx, face_band[:, 1].min() - 0.077 * wh, eye_z)), Matrix.Identity(3), 1.79 * wh),
        "back": ("Spine2", Vector((sx, back_band[:, 1].max(), back_z)), Matrix.Identity(3), 1.55 * shoulders),
        "hand": ("RightHand", hand + along * 0.61 - back_of_hand * 0.17 * hand_len + forward * 0.12 * hand_len, hand_rot, 1.86 * shoulders),
    }
    placed = {}
    for name, (bone_suffix, loc, rot, scale) in specs.items():
        n = nudges.get(name, {})
        loc = loc + Vector((-n.get("right", 0), -n.get("forward", 0), n.get("up", 0)))
        scale *= n.get("scale", 1)
        e = bpy.data.objects.new(f"socket_{name}", None)
        arm.users_collection[0].objects.link(e)
        e.empty_display_type, e.empty_display_size = "ARROWS", 0.15
        e.parent, e.parent_type, e.parent_bone = arm, "BONE", bone(arm, bone_suffix).name
        e.matrix_parent_inverse = Matrix.Identity(4)
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.LocRotScale(loc, rot.to_quaternion(), Vector((scale,) * 3))
        bpy.context.view_layer.update()
        placed[name] = (bone_suffix, tuple(round(c, 3) for c in loc), round(scale, 3))
    return placed


def bone(arm, suffix):
    for pb in arm.pose.bones:
        if pb.name == suffix or pb.name.endswith(":" + suffix):
            return pb
    sys.exit(f"No {suffix} bone. Bones: {', '.join(b.name for b in arm.pose.bones)}")


def has_bone(arm, suffix):
    return any(pb.name == suffix or pb.name.endswith(":" + suffix) for pb in arm.pose.bones)


def vertices(meshes, arm):
    """Rest-pose world positions of every vertex, plus how much the head moves each one."""
    head_bones = {b.name for b in arm.pose.bones if b.name.split(":")[-1] in ("Head", "HeadTop_End", "headfront")}
    cos, weights = [], []
    for o in meshes:
        groups = {g.index for g in o.vertex_groups if g.name in head_bones}
        for v in o.data.vertices:
            cos.append(tuple(o.matrix_world @ v.co))
            weights.append(sum(g.weight for g in v.groups if g.group in groups))
    return np.array(cos), np.array(weights)


# ---- colour-region mask -----------------------------------------------------------------------------------------

def make_mask(arm, meshes, pinned, path):
    """
    Writes an RGB mask (main/trim/accent) in the texture's UV layout: each texel joins the region whose colour it is
    closest to, if close enough. Everything the head moves (skin, eyes, hair) is left out of every region.
    """
    image = base_colour_image(meshes)
    if not image:
        print("! no base-colour texture; skipping the mask")
        return None
    w, h = image.size
    px = np.empty(w * h * 4, np.float32)
    image.pixels.foreach_get(px)
    rgb = px.reshape(h, w, 4)[..., :3]
    covered, head = uv_coverage(meshes, arm, w, h)
    lab = to_lab(rgb) * [LIGHTNESS_WEIGHT, 1, 1]

    usable = covered & ~head
    refs, guessed = {}, None
    if len(pinned) < len(REGIONS):
        guessed = cluster(lab[usable])
    for r in REGIONS:
        refs[r] = to_lab(np.array(pinned[r]))[None] * [LIGHTNESS_WEIGHT, 1, 1] if r in pinned else None
    # Fill unpinned regions with the most common colours, skipping any too close to one already taken (k-means often
    # splits a big panel into lit and shaded halves, which should stay one region).
    for r in REGIONS:
        if refs[r] is not None:
            continue
        taken = [p[0] for p in refs.values() if p is not None]
        pick = next((c for c, _ in guessed or [] if all(np.linalg.norm(c - t) > REGION_FAR for t in taken)), None)
        refs[r] = None if pick is None else pick[None]

    dist = np.stack([np.linalg.norm(lab - refs[r][0], axis=-1) if refs[r] is not None else np.full((h, w), 1e9) for r in REGIONS], -1)
    member = 1 - np.clip((dist - REGION_NEAR) / (REGION_FAR - REGION_NEAR), 0, 1)
    member *= (dist == dist.min(-1, keepdims=True))            # a texel belongs to its nearest region only
    member *= usable[..., None]
    blurred = member.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        blurred += np.roll(np.roll(member, dy, 0), dx, 1)
    member = blurred / 5
    f = max(1, w // MASK_SIZE)
    small = member[: h // f * f, : w // f * f].reshape(h // f, f, w // f, f, 3).mean((1, 3))
    small = np.round(small * MASK_LEVELS) / MASK_LEVELS

    out = bpy.data.images.new("region_mask", small.shape[1], small.shape[0], alpha=False)
    out.colorspace_settings.name = "Non-Color"
    out.pixels.foreach_set(np.concatenate([small, np.ones(small.shape[:2] + (1,))], -1).astype(np.float32).ravel())
    out.filepath_raw, out.file_format = path, "PNG"
    out.save()
    coverage = {r: round(float((member[..., i] > 0.5).sum() / max(usable.sum(), 1)), 3) for i, r in enumerate(REGIONS)}
    colours = {r: (to_hex(pinned[r]) + " (pinned)" if r in pinned else lab_hex(refs[r][0]) if refs[r] is not None else "none") for r in REGIONS}
    return {"path": path, "colours": colours, "coverage": coverage, "guesses": [(lab_hex(c), round(s, 3)) for c, s in (guessed or [])]}


def base_colour_image(meshes):
    for m in materials(meshes):
        bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        link = next(iter(bsdf.inputs["Base Color"].links), None)
        if link and link.from_node.type == "TEX_IMAGE":
            return link.from_node.image
    return None


def uv_coverage(meshes, arm, w, h):
    """Which texels any face uses, and which belong to faces the head moves."""
    head_bones = {b.name for b in arm.pose.bones if b.name.split(":")[-1] in ("Head", "HeadTop_End", "headfront")}
    covered = np.zeros((h, w), bool)
    head = np.zeros((h, w), bool)
    for o in meshes:
        mesh = o.data
        groups = {g.index for g in o.vertex_groups if g.name in head_bones}
        hw = np.array([sum(g.weight for g in v.groups if g.group in groups) for v in mesh.vertices])
        mesh.calc_loop_triangles()
        uv = mesh.uv_layers.active.data
        for t in mesh.loop_triangles:
            p = np.array([uv[l].uv[:] for l in t.loops]) * [w, h]
            inside = triangle(p, w, h)
            if inside is None:
                continue
            (y0, y1, x0, x1), hit = inside
            covered[y0:y1, x0:x1] |= hit
            if hw[list(t.vertices)].mean() > 0.5:
                head[y0:y1, x0:x1] |= hit
    return covered, head


def triangle(p, w, h, grow=1.5):
    """Texels inside a UV triangle (in pixels), grown ~1.5 px so seams don't leak; None if degenerate or off-image."""
    x0, y0 = np.maximum(np.floor(p.min(0)).astype(int) - 2, 0)
    x1, y1 = np.minimum(np.ceil(p.max(0)).astype(int) + 2, [w - 1, h - 1])
    if x1 < x0 or y1 < y0:
        return None
    (ax, ay), (bx, by), (cx, cy) = p
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-9:
        return None
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
    l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
    e = grow / max(abs(den) ** 0.5, 1)
    return (y0, y1 + 1, x0, x1 + 1), (l1 >= -e) & (l2 >= -e) & (1 - l1 - l2 >= -e)


def cluster(samples, k=6, iterations=20, seed=7):
    """k-means over (weighted) Lab colours; returns [(centre, share)] biggest first."""
    rng = np.random.default_rng(seed)
    if len(samples) > 40000:
        samples = samples[rng.choice(len(samples), 40000, replace=False)]
    centres = samples[rng.choice(len(samples), k, replace=False)]
    for _ in range(iterations):
        nearest = np.argmin(((samples[:, None] - centres[None]) ** 2).sum(-1), 1)
        centres = np.array([samples[nearest == i].mean(0) if (nearest == i).any() else centres[i] for i in range(k)])
    shares = np.bincount(nearest, minlength=k) / len(samples)
    return sorted(zip(centres, shares), key=lambda c: -c[1])


def to_lab(rgb):
    rgb = np.asarray(rgb, np.float64)
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    xyz = lin @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz /= [0.95047, 1.0, 1.08883]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_hex(weighted):
    L, a, b = weighted[0] / LIGHTNESS_WEIGHT, weighted[1], weighted[2]
    fy = (L + 16) / 116
    f = np.array([fy + a / 500, fy, fy - b / 200])
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * [0.95047, 1.0, 1.08883]
    lin = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]]) @ xyz
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.clip(lin, 0, None) ** (1 / 2.4) - 0.055)
    return to_hex(np.clip(srgb, 0, 1))


def to_hex(rgb):
    return "#" + "".join(f"{round(float(c) * 255):02x}" for c in rgb)


def hex_colour(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) / 255 for i in (0, 2, 4))


def pair(s):
    k, _, v = s.partition("=")
    return k.strip(), v.strip()


# ---- export -----------------------------------------------------------------------------------------------------

def export(arm, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in (arm, *arm.children_recursive):
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_image_format="JPEG", export_jpeg_quality=85,
        export_draco_mesh_compression_enable=False,  # the stage has no Draco decoder
        export_animations=True, export_animation_mode="ACTIONS", export_def_bones=True,
        export_anim_slide_to_zero=True, export_extras=False, export_cameras=False, export_lights=False)


def report(args, glb, meshes, clips, sockets, mask):
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    print("\n=== prepared", args.id, "===")
    print(f"file      {glb}  {os.path.getsize(glb) / 1024 / 1024:.2f} MB, {tris} triangles")
    for move in CLIPS:
        print(f"move      {move:<10} <- {clips[move] or 'MISSING: add one in Meshy or pin with --clip'}")
    for name, (b, loc, scale) in sockets.items():
        print(f"socket    {name:<10} on {b:<10} at {loc} scale {scale}")
    if mask:
        for r in REGIONS:
            print(f"region    {r:<10} {mask['colours'][r]:<20} {mask['coverage'][r]:.0%} of the textured area")
        if mask["guesses"]:
            print("colours   most common:", ", ".join(f"{c} {s:.0%}" for c, s in mask["guesses"]))
        print(f"mask      {mask['path']}  {os.path.getsize(mask['path']) / 1024:.0f} KB")
    name = args.name or args.id.replace("-", " ").capitalize()
    const = args.id.upper().replace("-", "_")
    mask_part = f", regionMask: 'avatars/3d/{args.id}-regions.png'" if mask else ""
    print(f"\nmanifest  export const {const}: CharacterManifest = {{ id: '{args.id}', name: '{name}', url: 'avatars/3d/{args.id}.glb'{mask_part} }};")


main()
