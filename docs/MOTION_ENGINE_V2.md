# LumaRig Motion Engine v2

## Purpose

Motion v2 turns movement FX from separate Pan/Tilt channel oscillators into reusable position programs.

A position effect owns a motion relationship, not raw DMX channel numbers. If a fixture exposes 16-bit Pan/Tilt, the renderer automatically outputs coarse and fine channels.

## Position shapes

### Circle

- Pan: base waveform
- Tilt: same waveform shifted by 0.25 cycle
- Result: quadrature motion around the current position

### Figure 8

- Pan: base waveform at 1x rate
- Tilt: same waveform at 2x rate and 0.25-cycle phase offset
- Result: Lissajous-style figure-eight movement

### Diagonal

- Pan and Tilt use the same phase
- Result: coordinated diagonal travel

### Pan Sweep

- Pan only
- Tilt remains owned by the underlying look or position palette

### Tilt Sweep

- Tilt only
- Pan remains owned by the underlying look or position palette

## Relative motion

Position effects default to Relative to Look.

That means a saved Circle can run around:

- Center Stage
- Audience
- Cross
- Fan
- Any later calibrated position palette

without storing a new absolute Pan/Tilt center in the effect.

This is the behavior we want for reusable song programming.

## Selection distribution

Every motion program inherits Show Engine v1 distribution controls:

- Forward / Reverse
- Center Out / Outside In
- Mirror Pairs
- Odd → Even / Even → Odd
- Blocks
- Groups
- Wings
- Shift
- Phase Spread

So one Circle effect can become a symmetric pair movement, a center-out ripple, or a multi-wing chase without rebuilding the shape.

## Precision

Movement phasers route through `fixtureMovementUpdates()`.

Fixtures with Pan Fine / Tilt Fine use 16-bit movement automatically. Single-axis phasers only write the axis they own, so a Pan effect cannot accidentally reset Tilt.

## Musical timing

Motion uses the same BPM and cycle system as the rest of Show Engine:

- 1/4 beat
- 1/2 beat
- 1 beat
- 2 beats
- 1 bar
- 2 bars
- 4 bars

The existing MIDI clock / external transport source can drive the BPM.

## Next motion work

1. User-editable multi-lane motion shapes.
2. Per-lane waveform, rate, size, center, and phase.
3. Bounce and one-shot direction modes.
4. Stage-space movement paths that animate calibrated targets instead of raw Pan/Tilt.
5. Visual path preview in LumaViz.
6. Acceleration/deceleration shaping.
7. N-shot motion and cue-scoped lifetime.
