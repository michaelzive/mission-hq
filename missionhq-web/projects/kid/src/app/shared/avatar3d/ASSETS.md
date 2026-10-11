# Avatar 3D assets: the export contract

What a character `.glb` must contain for `AvatarStage` to pick everything up with no per-character code.
Check a fresh export at `/avatar-lab` → "Try your own model": every move, colour row and gear button the lab
enables is something it found in the file.

## Character file

- **Format**: binary glTF (`.glb`), one file per character, in `projects/kid/public/avatars/3d/<id>.glb`.
- **Budget**: ≤ 25k triangles, textures ≤ 1024×1024, aim for ≤ 3 MB per file.
- **Orientation**: facing +Z (Blender's glTF exporter handles this when the character faces −Y in Blender, i.e. front view).
  If an export comes out turned, set `yaw` in its manifest rather than re-exporting.
- **Scale**: doesn't matter; the stage scales every character to 2 units tall, feet on the floor.
- **Skeleton**: humanoid, so one set of moves works for every character. Keep the bone names Meshy's auto-rig gives you.

## Moves (animation clips)

Name the actions exactly (case-insensitive): `idle` (loops), `wave`, `cheer`, `dance`, `celebrate` (one-shots,
which ease back to idle). Missing clips just don't show up; extra clips are ignored.

## Colour regions (materials)

Name up to three materials `region_main`, `region_trim`, `region_accent`. The kid's chosen colour **multiplies** the
material's base colour/texture, so paint those areas in light greys and keep the detail in the shading. Anything
that should never change colour (skin, eyes, metal) uses other material names.

## Sockets (where gear attaches)

Add an **Empty** for each, parented to the right bone (Ctrl+P → Bone), named exactly:

| Empty | Parent bone | Origin goes… |
|---|---|---|
| `socket_head` | head | on top of the head, where a hat's brim sits |
| `socket_face` | head | in front of the eyes, where glasses sit |
| `socket_back` | spine/chest | on the back surface, between the shoulder blades |
| `socket_hand` | right hand | in the palm, where a held item's grip sits |

Rotate the empty so its local +Y points "up" for the gear (out of the head, along a held item) and +Z points forward.
Scale the empty to fit: gear is modelled for a standard head, so a big-headed character gets `socket_head` scaled
up, a small one scaled down. That per-character scale is how one hat fits every body.

## Gear file (later)

Same units as the stage (character = 2 units tall), origin at the attach point, +Y up, +Z forward.
The spike uses primitive placeholders (`accessories.ts`) built to the same rule.
