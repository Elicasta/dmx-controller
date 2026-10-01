# LumaRig Stage Sync

Stage Sync is a versioned proposal protocol between LumaRig and LumaViz. It is not last-writer-wins autosync.

## Ownership

- **LumaRig** owns patch, fixture control, calibration, programming, playback, and authoritative DMX output.
- **LumaViz** owns high-quality scene construction, cameras, materials, and visualization.
- **Stage Model** is the shared physical description negotiated between both apps.
- **VizBridge** transports data. It does not own stage state.

## Identity

A fixture UUID is permanent identity. Universe/address are mutable patch attributes.

Never key a fixture by DMX address. Repatching must not create a new fixture, lose calibration, or break scene references.

## Shared fixture model

UUID -> profile/mode -> universe/address -> XYZ -> rotation -> mounting -> parent -> calibration -> optics

Secondary patch points are represented explicitly as universe/address pairs.

## Shared scenery model

UUID -> type -> XYZ -> rotation -> scale/dimensions -> parent -> material/visibility

## Sync modes

### LOCKED
Incoming changes are visible as proposals but cannot mutate local state.

### REVIEW
Default. Incoming changes enter a review queue with before/after values. Operator can Accept, Reject, Compare, or inspect the entity.

### LIVE
Only explicitly enabled categories may auto-apply. Permissions are independent:
- fixture position
- scenery
- patch
- fixture profile/mode
- calibration

Patch, profile/mode, and calibration are high-risk categories. UI should require an explicit warning/arming action before enabling their LIVE permission.

## Conflict rule

Every proposal carries a base revision. If the target entity has advanced beyond that revision, do not silently apply it. Mark it conflicted and require comparison/review.

## History

Persist an append-only stage change journal containing:
- timestamp
- source
- entity UUID
- category
- before/after
- base revision
- resulting revision
- status

Each entity surfaces its revision, last editor, and last edit time.

## DMX transport rule

DMX output remains independent from Stage Sync. Semantic LumaViz frames may describe fixture state, but physical output resolves through:

Fixture UUID -> selected profile/mode -> universe -> start address -> parameter/channel offsets -> universe frame

Groups resolve each member against that member's own profile, mode, universe, and address.

## UI contract

Stage header:
`STAGE SYNC  LOCKED | REVIEW | LIVE`

Incoming card:
`LumaViz changed Mover 04`
`Position X 3.2 -> 3.8 m`
`Rotation Y 12 -> 18 deg`
`Accept | Reject | Compare`

Stage History columns:
`Time | Source | Entity | Change | Status`

Inspector footer:
`Last edited in LumaViz | 6:24 PM | Revision 38`
`Revert | Compare | Accept incoming`

## Next compatibility target

Keep schema names and concepts compatible with future GDTF/MVR adapters. Do not couple runtime logic directly to MVR files. Import/export should translate between external formats and the internal Stage Model.
