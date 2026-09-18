# Fixture Profiles and Instances

## Profile versus instance

A fixture profile describes a hardware model and mode. A fixture instance describes one physical unit in this show.

Profile-owned data:

- manufacturer, model, category, verification status
- modes and semantic channel assignments
- Pan/Tilt physical ranges and home positions
- movement inversion and allowed DMX ranges
- 8-bit or 16-bit movement capability, derived from fine-channel mappings
- beam-angle range and optional lens offset

Instance-owned data:

- name, ID, group, label color
- universe and address
- profile and mode selection
- physical transform
- mounting and orientation
- calibration
- selection and UI collapse state

Changing an instance name or location must never mutate the reusable profile.

## Semantic attributes

Profiles map channel offsets to attributes such as Intensity, RGBWAUV, Pan, Pan Fine, Tilt, Tilt Fine, Zoom, Focus, Iris, Gobo, Gobo Rotate, Prism, Prism Rotate, Strobe, and Macro.

Controls are capability-driven. A profile without Pan does not receive Pan commands. A profile with fine movement combines coarse/fine channels before geometry is calculated.

## Movement metadata

Moving profiles provide:

```ts
{
  panRangeDegrees,
  tiltRangeDegrees,
  panHomeDegrees,
  tiltHomeDegrees,
  panInvert,
  tiltInvert,
  panDMXMin,
  panDMXMax,
  tiltDMXMin,
  tiltDMXMax
}
```

Starter profiles are intentionally marked unverified. Physical accuracy requires confirming the exact manufacturer manual and fixture firmware/revision.

## Addressing

An address is `(universe, channel)`. Collision validation is scoped to a universe, prevents overflow beyond channel 512, and re-evaluates the footprint when a mode changes.
