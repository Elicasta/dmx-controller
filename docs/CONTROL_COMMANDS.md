# Control Commands and Registry

All control surfaces converge on `ControlCommand` envelopes. An envelope supplies a unique ID, source, timestamp, and command.

Current sources:

- `ui`
- `midi`
- `fx`
- `cue`
- `recorder`
- `sync`
- `audio`
- `surface`
- `system`

Current commands include full/update frame adapters, an exact recorder-output adapter, fixture selection, semantic fixture/group attribute and color control, non-destructive group masters, spatial targeting, effect lifecycle, cue navigation, blackout, and grand master.

The console uses `group.color` and `group.master.set` instead of rewriting arbitrary member channels. `frame.output.replace` is reserved for exact recorded-output playback; normal programming uses the base-frame or semantic command paths so master and blackout layers remain deterministic.

Spatial aiming example:

```ts
{
  type: 'fixture.target',
  fixtureIds: ['back-mover-1', 'back-mover-2'],
  target: { x: 0, y: 1.2, z: 3.6 },
  arrangement: 'fan-horizontal',
  spreadMeters: 4
}
```

The runtime resolves this command into each profile's coarse/fine movement channels. Mouse, future MIDI target pads, cues, macros, and the PWA must emit this command rather than calculating Pan/Tilt separately.

Exact position-palette recall uses normalized fixture values while keeping all profile conversion inside the runtime:

```ts
{
  type: 'fixture.position',
  positions: [
    { fixtureId: 'back-mover-1', panNormalized: 0.62, tiltNormalized: 0.41 }
  ]
}
```

This command is intentionally fixture-semantic. It does not expose or guess raw movement channel addresses.

Full-frame commands are a compatibility boundary for existing proven systems. New control surfaces should prefer semantic commands.

## Control Registry

The Control Registry exposes stable logical IDs, labels, categories, input types, ranges, command paths, and whether true press/release is supported. The existing MIDI Assigner now reads this registry. Future Performance Surfaces and the PWA must read the same registry.

Examples:

```text
go                         → cue.go
master                     → master.set
effect:blinder             → effect.press-release
fixture:<id>:pan           → fixture.attribute
fixture-select:<id>        → fixture.select
```

No future surface should bind directly to temporary React state, screen coordinates, or raw DMX unless the operator deliberately chooses an advanced raw-channel action.
