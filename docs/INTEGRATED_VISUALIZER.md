# Integrated Visualizer

LumaRig owns the show state and the visualizer renders that same state. The visualizer is not a separate application or project format.

## Product model

```text
LumaRig Show
├── Patch
├── Groups
├── Cues / FX / overrides
├── Stage scene
│   ├── Venue dimensions
│   ├── Scenic objects
│   ├── Screens / media sources
│   └── Venue preset
└── Resolved output
    ├── Physical DMX
    └── Integrated Visualizer
```

The Visualizer workspace and pop-out window both consume the same `StageSnapshot`. Closing the visualizer does not affect DMX output.

## Current renderer

The first integrated renderer is browser-native and dependency-free. It provides:

- perspective projection and camera orbit
- FOH, stage-left, stage-right, top and close cameras
- a 12-second flyby
- physical room/stage geometry
- fixture bodies and live beam position/color/intensity
- haze level
- crowd visualization
- FAST and QUALITY render modes
- physical stage objects with position, rotation and dimensions
- live screen textures from selected video inputs
- pop-out visualizer window

The rendering layer is isolated in `src/components/Visualizer3D.tsx` and camera/projection behavior is isolated in `src/core/visualizer-camera.ts`. This keeps a later GPU renderer swap possible without changing show data.

## Venue presets

Presets are complete replacement scenes, not additive overlays.

### Cornerstone · Main Sanctuary

Includes the rear wall, center projection, side displays, doors, scenic pixel bars, drums/shield, keyboard, pulpit, PA, monitors and projector.

### Apostolic Day 2026 · Rosen

Includes Signature Ballroom 2 dimensions, center 180-inch screen, black drape, scenic slats, choir riser, band area, pulpit riser, lectern, greenery, seating and lighting stands.

Loading one preset replaces the current scene so the two venue layouts never overlap.

## Warehouse

The Stage builder exposes reusable physical objects for stage decks, risers, screens, drape, truss, columns, audio, instruments, people and cameras. Warehouse objects receive independent IDs and can be positioned, rotated, resized and recolored.

## ProPresenter / NDI

Screen objects carry a source abstraction rather than hard-coding a renderer-specific input.

Current path:

```text
ProPresenter NDI output
  -> NDI virtual video input
  -> LumaRig video input selection
  -> screen texture in Visualizer
```

This keeps the visualizer usable without bundling an NDI SDK. A direct native NDI receiver can replace the input adapter later without changing stage presets, screen objects or rendering code.

## Legacy LumaViz transport

The existing semantic WebSocket and Art-Net visualizer transports remain in the codebase temporarily for compatibility and migration. They are no longer the primary product path. New visualizer work should target the integrated Visualizer workspace first.

## Merge rule

All integrated visualizer work stays on `feature/integrated-visualizer` until:

1. the current main build has been reconciled,
2. frontend and native tests pass,
3. browser tests pass,
4. both venue presets load independently,
5. the pop-out visualizer receives live show state,
6. fixture output, blackout and screen sources render without affecting physical DMX.
