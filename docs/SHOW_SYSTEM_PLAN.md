# DMX Controller — Show System Plan

## 2026 shared-runtime and physical-stage foundation

The active architecture is now defined in `ARCHITECTURE.md`. The first upgrade package establishes:

- a central `ShowRuntime` command/revision boundary;
- a shared Control Registry used by the existing MIDI Assigner;
- a finished-frame `OutputRouter` with virtual output and the existing uDMX adapter;
- versioned fixture and stage documents with one-time legacy backups;
- universe-aware fixture instances separated from profile movement geometry;
- canonical meter-based X/Y/Z transforms with feet/meters display;
- profile-aware 8/16-bit Pan/Tilt conversion;
- world-space beam rays using mounting, orientation, base rotation, and calibration;
- top, front, side, and perspective projections over the same coordinates;
- inverse target aiming through the shared runtime with coarse/fine DMX output;
- reusable stage, audience, and stage-element targets;
- converge, horizontal/vertical fan, mirror, and cross group distributions;
- persisted per-fixture calibration observations, inversion/offset solving, confidence, reset, and guarded copy;
- semantic spatial and exact absolute position palettes persisted in show schema version 2;
- room-boundary beam intersections driven by the same world-space rays as physical movement;
- explicit SELECT, MOVE, ROTATE, AIM, MEASURE, TARGET, and PATCH Stage Designer modes;
- direct mouse/touch dragging of fixtures and stage objects through the canonical coordinates;
- a persistent live status strip for cue, sync, tempo, output, MIDI, and FX health.
- an installable remote PWA using authenticated private relay rooms for separate-network control.

Calibration solving, inverse target aiming, position-palette recall, room-boundary beam intersections, direct stage dragging, and the first remote PWA are complete in the software model. Physical certification still requires measured fixture placement and an observed real-beam calibration pass. Stage-object collision meshes, the Performance Surface editor, a direct local WebSocket server, Art-Net, and sACN remain ordered follow-on packages. They must reuse this runtime and geometry foundation.

## North star

Build one approachable lighting instrument with five clear workspaces:

1. **Live** — fixtures, colors, intensity, blackout, and looks.
2. **Show** — ordered cues with one large GO button.
3. **Fixtures** — fixture library, modes, DMX addresses, groups, and selection.
4. **Connect** — DMX, general MIDI, Apple Network MIDI, and audio input.
5. **Settings** — performance guardrails and troubleshooting.

The visualizer lives beside the cue stack so the preview is always visible while programming or running a show.

The operator should not need to understand universes, protocols, or networking during a show. Technical configuration belongs in Connect; performance belongs in Live and Show.

## Design rules

- One source of truth for every fixture value.
- Preview and physical outputs consume the same show state.
- DMX remains the real-time, show-critical path.
- MIDI, clocks, and smart lights connect through adapters instead of leaking into the cue engine.
- Every automated action must still have manual GO, Stop, and Blackout controls.
- Save automatically, export explicitly, and recover cleanly after a crash.
- Add depth progressively: useful with one light, scalable to many.

## Core architecture

```text
Live controls ─┐
Cue stack ─────┼──> Show engine ──> Fixture state ──┬──> Visualizer
MIDI / clock ──┘                                    ├──> DMX output
                                                    └──> Smart-light adapters
```

The core data model stays small:

- **Fixture profile** — parameters and channel mapping.
- **Patch** — fixture, universe, address, mode, and stage position.
- **Look** — complete fixture values at one moment.
- **Cue** — a look plus fade/hold timing and trigger metadata.
- **Show** — ordered cues and connection mappings.
- **Transport** — current cue, next cue, play state, beat, and time.

## Phased roadmap

### Phase 0 — Physical output proof ✅

- Anyma uDMX discovery and direct USB output.
- 512-channel universe, blackout, disconnect-to-zero, and error reporting.
- Real Mega Par Profile Plus verified on address 001.

### Phase 1 — Fixture programmer ✅

- Mega Par Profile Plus Ch05 fixture panel.
- RGB, UV, master dimmer, presets, looks, and smooth fades.
- Persistent custom looks and raw-channel troubleshooting.

### Phase 2 — Show Builder + Visualizer ✅

- Ordered cue stack.
- Capture the current fixture state into a cue.
- Per-cue fade time.
- GO, previous, next, update, reorder, and delete.
- Automatic local save.
- Show notes for set lists, transitions, reminders, and safety details.
- Dimensional stage designer driven by live fixture state.
- Custom fixture labels, zone colors, horizontal/vertical placement, depth, and beam direction.
- Editable back walls, drum kits, performers, LED screens, and risers.

### Phase 2.5 — Live Show Recorder ✅

- Load a local audio track and record a lighting performance from the beginning. ✅
- Capture the complete DMX universe at 20 Hz while storing only changed channels. ✅
- Record manual controls, MIDI moves, cues, fades, effects, and moving-light parameters together. ✅
- Keep an always-visible Stop + save control while performing from Live. ✅
- Save multiple named takes and replay lighting with a matching reattached track. ✅
- Play saved takes as lighting-only timelines when the audio file is unavailable. ✅
- Add waveform display, count-in, timeline trimming, punch-in, and take duplication in a later editing phase.

This phase deliberately uses a cue stack instead of a full DAW-like timeline. It is fast to operate, easy to understand, and is now the playback engine for MIDI and other control sources.

### Phase 3 — General MIDI + Network MIDI (foundation complete)

- Native macOS MIDI input through Core MIDI. ✅
- USB MIDI, IAC, and Apple Network MIDI sessions appear as equal inputs. ✅
- Full MIDI Assigner with add, learn, relearn, remove, and automatic save. ✅
- Map notes, pads, and switched CC to show transport, colors, effects, tap tempo, fixture selection, and Blackout. ✅
- Map continuous CC to grand master, effect BPM/depth, RGB color levels, and profile-mapped fixture parameters. ✅
- Dynamic fixture assignments include dimmer/color channels and supported moving-head Pan, Tilt, Gobo, Focus, Prism, and speed. ✅
- Existing GO, previous, blackout, and grand-master maps migrate automatically. ✅
- Receive notes, CC, MIDI Clock, transport, and song position. ✅
- Extend mappings to saved looks and individual show cues.
- Soft takeover for faders so hardware does not cause value jumps.
- Per-show MIDI maps with a safe global fallback.

### Phase 4 — Ableton synchronization

Implement in this order:

1. **MIDI notes/CC** for exact cue launches from an Ableton MIDI track. ✅
2. **MIDI Clock + Song Position** for tempo-synced effects and transport state. ✅
3. **Ableton Link** for shared tempo/beat/phase if licensing fits the final distribution model.
4. **Optional Max for Live bridge** for richer two-way status or MTC-style absolute position.

The Show workspace can now assign a saved lighting take to an external song by name and BPM. Once armed, MIDI Start, Continue, Stop, Clock, and Song Position from Ableton, Logic, IAC, Apple Network MIDI, or another general MIDI source drive the recorded lighting timeline. The assignment is stored with the show and the same clock also feeds tempo-synced effects. ✅

- Per-song lighting advance from -5000 ms to +5000 ms for latency calibration. ✅
- Live health indicators for MIDI input, clock detection, and DAW transport. ✅
- Built-in setup directions for Mac IAC, Ableton Live Song clock mode, and Logic Pro SPP clock mode. ✅

Ableton Live can send MIDI Clock, but it cannot natively send MIDI Timecode. Its documented MTC output path uses a Max for Live device. That makes note/CC cue triggers the clearest first integration and MIDI Clock the clearest second step.

### Phase 5 — Fixture library + reusable effects (foundation complete)

- Patch fixtures by profile, mode, address, and group. ✅
- Detect address collisions and universe overflow before output. ✅
- Collapse, select, and organize fixture groups. ✅
- Global color and intensity controls use semantic parameters across profiles. ✅
- Portable Pulse, Strobe, Chase, Rainbow, Dimmer Wave, Color Chase, Sparkle, Lightning, UV Pulse, Moving Sweep, Bump, Blinder, and Finale effects. ✅
- Performance FX dock in Show with immediate tempo, depth, Stop FX, and active-effect feedback. ✅
- True momentary Bump and Blinder controls: hold to fire, release to restore the underlying look or resume the previous effect. ✅
- MIDI note-off and switched-CC release handling for momentary performance effects. ✅
- Expanded starter look library with clean white, saturated colors, blacklight, and house-light palettes. ✅
- Manual BPM, tap tempo, and received MIDI Clock tempo. ✅
- Profile-mapped controls for moving-head Pan, Tilt, speed, color wheel, gobo, focus, and prism. ✅
- Verified Mega Par Profile Plus profile plus clearly labeled ADJ, SHEHDS, and generic starter templates. ✅
- Verify and expand model-specific profiles from official manuals as fixtures are added to the real rig.

### Phase 6 — Audio-reactive shows (safe beta foundation)

- Opt-in audio input with a live energy meter. ✅
- Monitor-only by default; physical output requires a separate Arm action. ✅
- Sensitivity and global intensity cap. ✅
- Add frequency bands, beat/onset detection, BPM confidence, and audio-to-effect routing.
- Add calibration, smoothing, hold/release, and rehearsal recording.

### Phase 7 — Network and smart lighting

- Add a general `SmartLightOutput` adapter alongside DMX.
- Govee device discovery and capability mapping.
- Prefer local LAN control where a device officially supports it.
- Fall back to Govee's cloud API for power, brightness, color, and scenes.
- Mark cloud devices as **scenic / non-real-time** in the UI.
- Rate-limit and coalesce changes per device.

Govee's official cloud API currently limits control to two requests per second per device, so it is appropriate for slow room looks and cue changes—not smooth 40 Hz fades. Govee devices should never block DMX cue playback.

### Phase 8 — Production readiness

- Expand and verify model-specific fixture profiles against official manuals.
- Export/import stage designs, shows, and versioned backups.
- Full-screen performance mode and keyboard shortcuts.
- Reconnect behavior, output health, and pre-show diagnostics.
- Move long recordings from browser storage to versioned show-package files with embedded or referenced audio.
- Optional phone/tablet remote.
- Crash recovery and a tested show checklist.

### Console workspace redesign — complete

- Reorganized the frontend into Setup, Program, Show, and Live without duplicating runtime state. ✅
- Added compact fixture/group browsers, batch patching, group assignment, contextual inspection, and existing stage/calibration tools under Setup. ✅
- Added profile-semantic fixture faders, group masters, color control, target-aware effects, shared stage selection, and reusable looks under Program. ✅
- Reframed cue stacks and the existing recorder/external-sync workflow as Cues and Tracks under Show. ✅
- Added a fixed-window performance surface with current/next cue, GO, performance FX, looks, Grand Master, and health status under Live. ✅
- Preserved one global non-destructive blackout control and moved connection engineering under Setup. ✅
- Persisted ordered show groups through schema version 3 while keeping old shows loadable. ✅

## Practical definition of “show ready”

For the first real show, the target is intentionally modest:

- Patch every fixture.
- Build and name the cue stack.
- Preview every cue.
- Trigger GO manually or from Ableton MIDI notes.
- Keep physical blackout available at all times.
- Export a show backup before doors open.

That is enough to run a dependable show without turning the app into a complicated lighting console.

## Technical references

- Ableton Live 12 routing and MIDI synchronization: https://www.ableton.com/en/manual/routing-and-i-o/
- Ableton MIDI synchronization guide: https://help.ableton.com/hc/en-us/articles/209071149-Synchronizing-Live-via-MIDI
- Official Ableton Link library: https://github.com/Ableton/link
- Apple Core MIDI: https://developer.apple.com/documentation/coremidi
- Govee developer platform: https://developer.govee.com/
- Govee device control capabilities and limits: https://developer.govee.com/reference/control-you-devices
