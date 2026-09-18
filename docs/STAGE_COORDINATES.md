# Stage Coordinates and Beam Geometry

## Canonical unit and origin

All stored physical coordinates are meters. The operator may display and edit feet; conversion occurs only at the UI boundary.

The show origin is center stage at floor level on the downstage reference line:

- `X`: stage left (negative) to stage right (positive)
- `Y`: floor (`0`) to ceiling (positive)
- `Z`: downstage (`0`) to upstage/depth (positive)

This is a right-handed world coordinate system. Audience locations normally have negative `Z` values.

## Fixture transform

Every fixture instance resolves to:

```ts
{
  position: { x, y, z },
  rotation: { yaw, pitch, roll }
}
```

Yaw rotates around world/local `Y`, pitch around `X`, and roll around `Z`. Rotation is expressed in degrees. Mounting (`hanging`, `floor`, `wall`, `custom`) and orientation (`normal`, `inverted`, `rotated90`, `rotated180`, `custom`) are separate metadata.

## Movement order

The unrotated hanging-fixture home ray points down: `(0, -1, 0)`.

Forward movement is deterministic:

1. Convert coarse/fine DMX to a normalized `0…1` value.
2. Apply profile DMX min/max.
3. Apply profile and per-instance inversion.
4. Convert through the profile's physical Pan/Tilt ranges and home offsets.
5. Apply instance calibration offsets.
6. Apply local tilt, then local pan.
7. Apply orientation, mounting, then the fixture's base yaw/pitch/roll.
8. Normalize the world-space ray.

The beam origin is the fixture position plus the profile's rotated lens offset, when supplied.

## Engineering views

Top, front, side, and perspective views project the same world positions. Changing views never rewrites coordinates.

- Top: `X/Z`
- Front: `X/Y`
- Side: `Z/Y`
- Perspective: a stable stage projection for programming context

In `MOVE` mode, mouse and touch pointer input is unprojected into the active view's physical editing plane. Top edits `X/Z`, front edits `X/Y`, side edits `Z/Y`, and perspective edits `X/Z` while preserving fixture height. Positions are clamped to the shared stage bounds and persisted through the existing patch/stage documents; the renderer never stores a second visual-only position.

## Inverse aiming

`AIM` uses the exact inverse of the forward model:

1. Resolve the lens origin and target in world coordinates.
2. Transform the normalized target direction into fixture-local space.
3. Enumerate physically equivalent Pan/Tilt solutions.
4. Reject values outside the fixture profile's real movement range.
5. Apply per-instance inversion and calibration in reverse.
6. Choose the reachable solution requiring the least movement from the current state.
7. Convert normalized movement into 8-bit or coarse/fine 16-bit DMX.

The runtime verifies the chosen solution by running it forward again. A target is marked reachable only when the reconstructed beam is within `0.1°`; automated round-trip tests use a stricter `0.02°` threshold.

Reusable targets include stage center/left/right, back wall, audience center/left/right, and every positioned stage element. Groups can converge, fan horizontally or vertically, mirror, or cross around one target. Target distribution happens before each fixture is independently solved.

## Legacy migration

Legacy percentage fields remain readable. They are converted once to physical transforms using the stored/default stage dimensions. The original fixture and stage JSON is backed up before the versioned document replaces it.

## Beam intersections

The renderer terminates each live beam against the shared room volume (floor, ceiling, front/back, and side walls). Intersections are calculated from the same world-space `BeamRay` used by aiming, so a visual hit never invents a separate beam angle. The nearest positive surface hit wins; a beam with no valid hit is rendered to the configured fallback throw distance.

Stage-object collision meshes remain a follow-on refinement. They will extend the same intersection service rather than changing fixture movement math.

## Position palettes

Position palettes are stored with the show in one of two forms:

- **Spatial** palettes reference a reusable target, arrangement, and spread. Recall resolves the target through the current stage geometry, so moving a fixture or target adapts the result.
- **Absolute** palettes store normalized Pan/Tilt values per fixture for exact recall.

Both palette types dispatch through `ControlCommand`. Spatial palettes reuse `fixture.target`; absolute palettes use `fixture.position`. The renderer reads the resulting DMX channels back through forward geometry in both cases.
