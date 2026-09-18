# DMX Controller Architecture

## Decision

`ShowRuntime` is the authoritative owner of the current base fixture frame, resolved output frame, runtime multipliers, blackout state, and the command revision that produced them. React renders mirrors of runtime state; it is not the output authority. Every complete output frame is routed to both the virtual output and the connected uDMX adapter.

```text
Mac UI / MIDI / Cue / FX / Recorder / DAW sync / Remote PWA
                       │
                       ▼
                 ControlCommand
                       │
                       ▼
                  ShowRuntime
        base frame + non-destructive layers
              revision + source trace
                       │
                       ▼
                finished DMX frame
                       │
                 OutputRouter
                 ┌─────┴─────┐
                 ▼           ▼
          VirtualOutput   uDMX adapter
                 │
                 ▼
          Stage beam model
```

Stage target commands use the same path. The Stage Designer resolves a named world-space target into a `fixture.target` command; `ShowRuntime` performs inverse geometry, writes the fixture's 8/16-bit Pan/Tilt channels, and emits the finished frame through `OutputRouter`. The renderer then reads those same channels back through forward geometry. It never stores a second aiming value.

Position palettes preserve that rule. Spatial palettes retain semantic target references and recall through `fixture.target`; absolute palettes retain fixture-normalized values and recall through `fixture.position`. Beam intersections are derived from the resulting runtime ray and the shared room bounds.

## Current-flow audit

Before this foundation, Live controls, fades, cues, effects, the recorder, audio input, MIDI, and external sync all eventually called one `commitUniverse` function. That was a useful convergence point, but the React component and mutable refs jointly owned state, source information was lost, and the Stage Designer invented a small visual pan angle unrelated to fixture geometry.

The migration preserves that working convergence point as an adapter:

- Existing algorithms may still produce exact 512-channel frames.
- `commitUniverse` now emits a `frame.replace` command into `ShowRuntime` with a source (`ui`, `midi`, `fx`, `cue`, `recorder`, `sync`, `audio`, or `system`).
- Semantic fixture faders and colors emit `fixture.attribute` and `fixture.color` commands.
- The runtime revisions the state and records channel-level source metadata.
- `OutputRouter` gives the identical finished frame to virtual and physical outputs.
- React and the Stage Designer observe the runtime result.

This is an incremental boundary, not a rewrite. FX and recorded takes remain exact-DMX producers until their semantic migrations are proven.

## Ownership rules

- `ShowRuntime`: base fixture universes, resolved output universes, fixture selection mirror, group/grand master layers, blackout state, revision, last command, and per-channel source trace.
- Fixture profile: hardware capabilities, channel personality, movement ranges, DMX limits, and optics.
- Fixture instance: show-specific identity, universe/address, group, transform, mounting, orientation, and calibration.
- Stage Designer: a renderer/editor over runtime and geometry state. It does not own a second Pan/Tilt value.
- Output drivers: consumers of final frames. They never calculate fixture state.
- React: workspace state, temporary editor state, and render mirrors of runtime state.
- Remote PWA: an authenticated control surface. It receives revisioned snapshots and can submit only allow-listed semantic `ControlCommand` values; it never owns state or sends DMX frames.

## Console view architecture

The redesigned frontend has four workspaces: Setup, Program, Show, and Live. They share one fixture selection and call the same application/runtime adapters. `console-domain.ts` is the view-model boundary for group reconciliation, semantic fixture capabilities, selection, profile-safe intensity, and effect compatibility. Reusable memoized console components render fixture browsers, color controls, fader strips, FX controls, and look strips without owning DMX state.

Group definitions are persisted show entities. Fixture membership remains compatible with the existing fixture `group` field and is reconciled into ordered group membership when a show loads. A group master is a runtime multiplier over semantic dimmer attributes; moving it never rewrites fixture base intensity. Restoring it to 100% therefore restores the programmed fixture levels exactly.

## Compatibility adapters

- Legacy full-frame cue, fade, FX, recorder, audio, and sync paths use `frame.replace`.
- Existing uDMX commands are wrapped by `CallbackOutputDriver`.
- Existing MIDI assignments are exposed through the shared Control Registry.
- Old fixture and stage arrays migrate to schema-versioned documents. Original JSON is copied to a backup local-storage key before replacement.
- Version 1 show documents migrate through version 2 position palettes to version 3 persisted fixture groups and cue metadata after the original serialized show is copied to a backup key.

## Next architectural increments

1. Stage-object collision meshes and measurement overlays.
2. Semantic cue/programmer/FX layers and explicit HTP/LTP resolution.
3. Managed show-package media.
4. Optional local WebSocket server for direct trusted-LAN/VPN control; the implemented separate-network transport uses a private Supabase Realtime relay.
5. Performance Surface renderer over the same Control Registry.
6. Art-Net and sACN output drivers.

None of these may bypass `ControlCommand → ShowRuntime → finished frame → OutputRouter`.
