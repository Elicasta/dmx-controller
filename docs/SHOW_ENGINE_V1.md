# LumaRig Show Engine v1

## Goal

Make LumaRig capable of building tightly synchronized concert and worship lighting without forcing the operator to hand-program every fixture.

The engine is fixture-semantic first. UI, MIDI, remote control, cues, busking, and song sync should all drive the same underlying fixture attributes and playback resolver.

## Design rules

1. Fixture selection order is data.
2. Effects operate on semantic attributes, not raw DMX channels.
3. Effects may be absolute or relative to the current look.
4. Musical timing is expressed in beats/bars and can follow external BPM.
5. Spatial movement uses calibrated stage geometry when available.
6. Intensity and non-intensity attributes are resolved differently during playback.
7. Cue data should support tracking instead of requiring full snapshots forever.
8. Output hardware stays behind the existing output-driver boundary.

## Engine modules

### fixture-order.ts

Defines reusable fixture distribution behavior:

- Forward
- Reverse
- Center Out
- Outside In
- Odd / Even
- Even / Odd
- Mirror Pairs
- Blocks
- Groups
- Wings
- Shift

Blocks make adjacent fixtures share phase. Groups interleave phase units. Wings mirror phase progression across sections of a selection.

### phaser-engine.ts

Reusable waveform renderer for semantic fixture attributes.

Current controls:

- Parameter
- Waveform
- BPM
- Cycle length in beats
- Depth
- Phase spread
- Absolute / relative mode
- Direction
- Fixture order
- Blocks / groups / wings / shift

Relative mode offsets the fixture's current attribute value instead of replacing it. This allows one movement effect to be reused over many looks.

### cue tracking + timing

Cue tracking is now active in the real cue stack, not just a helper:

- New and updated cues store sparse channel instructions.
- Untouched values inherit through later cues.
- Reordering cues recomputes sparse instructions so each cue keeps its resolved look.
- Deleting a cue preserves the resolved looks of surviving cues.
- Legacy snapshot cues remain readable.
- Show-file schema v4 stores tracking plus attribute-family timing.

Cue timing can override fade, delay, and curve independently for:

- Intensity
- Color
- Position
- Beam

This allows color to snap while movement travels over a bar and intensity fades on its own timing.

### playback-stack.ts

Provides a deterministic layer resolver for cue, FX, programmer, busk, bump, and master layers.

Supported merge modes:

- LTP
- HTP
- Add
- Multiply

Intensity channels can use HTP while color, position, beam, and other attributes remain LTP.

## Spatial positions

Spatial position palettes now remember fixture order as well as:

- Target
- Arrangement
- Spread

The target engine supports:

- Converge
- Horizontal fan
- Vertical fan
- Mirror
- Cross

Ordered aiming is routed through ShowRuntime so stage programming and palette recall use the same behavior.

## UI changes

The FX editor exposes saved group order all the way into phase assignment, plus:

- Fixture order
- Direction
- Cycle length
- Absolute / Relative to Look
- Blocks
- Groups
- Wings
- Shift
- 0–200% phase spread

The stage AIM controls expose:

- Target
- Arrangement
- Fixture order
- Spread
- Aim selected

## Next engine steps

1. Multi-attribute phasers so Pan + Tilt + Zoom can live in one effect.
2. Step-based phasers with per-step width, transition, acceleration, and deceleration.
3. Selection grids persisted on fixture groups.
4. Playback stack integrated into the live runtime instead of effect loops writing directly into the base frame.
5. N-shot effects and one-shot hits.
6. Song-section recipes driven by LumaStudio/Ableton transport.
7. Art-Net/sACN multi-universe output at a fixed render cadence.
8. Visualizer preview of phaser geometry before output.

## Reference concepts

The architecture is informed by established console behavior rather than copied UI:

- grandMA3 selection grids, MAtricks, phasers, width/phase/speed layers, and playback priorities.
- ETC Eos relative/absolute/step effects, grouping, trail, cue tracking, and HTP/LTP behavior.
- ChamSys group-grid spread and center-in/center-out direction concepts.

LumaRig keeps its own workflow: visual, stage-aware, song-aware, and usable from desktop or remote.
