# LumaRig Cue Engine v3

## Purpose

Cue Engine v3 moves LumaRig from full-frame scene playback toward console-style show programming.

A cue can now carry only the instructions that change. Unchanged output tracks forward from previous cues.

## Tracking

New cues default to **Track** when the previous cue has a resolvable state.

Example:

- Cue 1 sets Wash = Blue and Movers = Center.
- Cue 2 changes only Movers = Fan.
- Cue 3 changes only Wash = Red.

Cue 2 does not need to restate Blue. Cue 3 does not need to restate Fan.

If an imported legacy cue does not contain enough state to establish a safe tracking base, LumaRig captures the next cue as **Block** instead of guessing.

### Track

Stores channel changes relative to the previous resolved cue.

### Block

Stores a complete 512-channel snapshot. It becomes a new tracking base.

Changing Track ↔ Block in the Cue Inspector converts the cue data rather than changing only a UI flag.

## Transition curves

Cue transitions support:

- S-Curve
- Linear
- Ease In
- Ease Out

The transition math is shared by all cue playback paths.

## Attribute-family timing

Each cue has a default Fade In, Fade Out, and launch Delay.

A cue can override fade and delay for four semantic families:

- Intensity
- Color
- Position
- Beam

Fixture profile channel definitions decide which DMX channels belong to each family.

This allows programming such as:

- Color: snap
- Intensity: 400 ms
- Position: 1800 ms S-Curve
- Beam: 250 ms after a 300 ms delay

without hand-editing raw DMX channel timing.

## Intensity fade out

If an intensity value falls, the cue uses Fade Out unless the Intensity family has its own fade override.

Other parameter families use Fade In unless explicitly overridden.

## Linked FX

A linked effect starts after the cue transition reaches its programmed state.

This fixes the previous behavior where starting the effect could call stopFade() and cancel the cue's own fade.

Future playback-layer integration can allow cue fades and relative effects to run concurrently without either owning the full base frame.

## Compatibility

Show file schema version remains 3.

The new fields are optional:

- transition
- timing
- tracking
- changes

Existing full-universe cue snapshots remain valid and play back unchanged.

## Next cue work

1. Integrate Show Engine playback layers so cues and relative FX can overlap concurrently.
2. Add finite-cycle / N-shot effects.
3. Add step effects and chases with per-step dwell/fade.
4. Add cue-part style timing groups if real shows need more than the four semantic families.
5. Extend tracked cue state across multiple output universes.
6. Add recipe-style cues that reference palettes/effects rather than baking values.
