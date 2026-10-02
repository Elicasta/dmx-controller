# Ableton Live Integration

## Goal

Use Ableton Live's Arrangement as a musical reference while LumaRig remains the show and DMX engine.

The operator should be able to build a track in Live, create locators for musical sections, and see those same sections against the LumaRig Timeline. Live transport can position the lighting timeline without copying audio or rebuilding the arrangement inside LumaRig.

## Data path

```
Ableton Arrangement
  └─ Max for Live LiveAPI
       ├─ locator names + beat positions
       ├─ tempo + meter
       └─ exact current beat
             │
             v
      Node for Max WebSocket
             │ ws://127.0.0.1:47777/studio
             v
      existing Studio Bridge
             │
             v
      existing LumaRig Timeline / ShowRuntime
             │
             v
             DMX
```

There is no second lighting runtime.

## Bridge commands

### `ableton.snapshot`

Sent when the Live locator map, tempo, or meter changes.

```json
{
  "type": "ableton.snapshot",
  "snapshot": {
    "setId": "123",
    "setName": "Ableton Live",
    "bpm": 84,
    "beatsPerBar": 4,
    "currentBeat": 32,
    "playing": true,
    "locators": [
      { "id": "101", "name": "VERSE 1", "beat": 16 },
      { "id": "102", "name": "CHORUS", "beat": 32 }
    ]
  }
}
```

### `ableton.transport`

Lightweight position correction sent while transport changes.

```json
{
  "type": "ableton.transport",
  "playing": true,
  "currentBeat": 36.25,
  "bpm": 84,
  "beatsPerBar": 4
}
```

## LumaRig behavior

- Locator data is runtime-only in the first integration pass. It does not mutate or pollute saved Show files.
- Locator beat positions are converted to LumaRig bars using the current meter.
- Ableton position enters LumaRig through the shared TransportEngine as the `ableton` source, then drives the existing Timeline renderer. Timeline cues, takes, video and FX keep their existing behavior.
- The TransportEngine arbitrates Ableton, Timeline, MIDI, Studio and other sources so two transports cannot own the playhead simultaneously.
- MIDI Clock remains a fallback DAW transport. Do not arm it as a second authority while the Max bridge owns playback.
- LumaRig's Lighting Advance / Delay remains the timing offset for rendered lighting.
- If tempo lock is off, Ableton tempo becomes the LumaRig master tempo.
- A bridge disconnect holds current lighting output and returns control to the operator. It does not stop audio or force blackout.

## Naming

No reserved naming syntax is required. Normal locators work:

`INTRO` → `VERSE 1` → `CHORUS` → `VERSE 2` → `BRIDGE` → `OUTRO`

A later pass can add opt-in command locators such as `LR:SHOW <name>`, `LR:CUE <name>`, or per-song automatic linking. Those should remain explicit so a harmless locator cannot unexpectedly change the live lighting show.

## Next pass

After this locator/transport foundation is proven in Live:

1. Pair a Live Set or Ableton song region with a stable LumaRig Song ID.
2. Add two-way locator selection so clicking a locator in LumaRig can jump Ableton.
3. Add optional command locators for deterministic cue/show recall.
4. Add a packaged `.amxd` release artifact after the source patch is verified inside the installed Live/Max version.
