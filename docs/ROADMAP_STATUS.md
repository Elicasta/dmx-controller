# LumaRig Roadmap Status

This audit is based on the current repository implementation plus `SHOW_SYSTEM_PLAN.md`, `ARCHITECTURE.md`, `TESTING.md`, `REMOTE_CONTROL.md`, `OUTPUT_DRIVERS.md`, and the stage/calibration documentation.

## Working now

- Anyma uDMX discovery, direct USB output, 512-channel frame handling, 40 Hz output, blackout, disconnect-to-zero, and failure reporting.
- Semantic fixture profiles, patching, collision/overflow validation, groups, color/intensity controls, moving-light parameters, and profile-aware effects.
- Shared `ControlCommand -> ShowRuntime -> OutputRouter` control path with virtual output and uDMX output.
- Looks, fades, cue stack, GO/previous/next, show notes, local persistence, and versioned migrations.
- Show recorder with changed-channel capture, saved takes, playback, lighting-only playback, and external MIDI transport sync.
- Native Core MIDI input, learnable mappings, MIDI Clock, Song Position, transport, continuous CC, momentary effects, and movement parameters.
- Ableton/Logic-compatible MIDI transport and timing offset workflow.
- Stage geometry with physical X/Y/Z coordinates, top/front/side/perspective views, beam projection, room intersections, aiming targets, group target arrangements, position palettes, and persisted fixture calibration.
- Setup / Program / Show / Live console redesign with shared selection and non-destructive group masters.
- Separate-network remote PWA relay through authenticated Supabase Realtime.
- Signed Tauri updater feed, Apple Silicon / Intel / Universal release builds, and in-app software updates.
- LumaRig branding and manual-only release publishing.
- Automated frontend/native test coverage and CI.

## Active Stage Editor v2 work

The `stage-editor-v2` branch is replacing the rough block-based stage editor without changing the lighting runtime.

Implemented on the branch:

- corrected plan-view orientation so upstage is visually up and downstage/audience is down;
- refined 3D perspective projection and stage orientation labels;
- real stage width/depth/height controls with feet/meters display;
- stage objects rendered from physical dimensions instead of only arbitrary block size;
- wall, drape, truss, LED screen, riser, lectern, drum-kit, and performer objects;
- dedicated stage-object inspector for name, type, color, X/Y/Z, W/H/D, and rotation;
- duplicate and delete controls directly in the stage view;
- Delete / Backspace shortcut and Escape-to-deselect;
- improved object library cards and scenery styling;
- stage-object selection now has a usable editing path rather than falling through to the fixture inspector;
- live-output ambient wash in the Show view;
- beam cones and endpoint pools instead of thin diagnostic lines;
- moving-head / static-fixture visual symbols with live lens color;
- scenery collision so beams terminate on stage objects before the room shell;
- 0.25 m / 0.5 m / 1 m snapping while dragging;
- Measure mode now surfaces throw distance plus horizontal/vertical angles.

## Remaining high-value work

### Stage / visualizer

- Better wall-segment editing, alignment, multi-select, and object layering.
- Rotation handles / direct manipulation instead of inspector-only rotation.
- Measurement overlays, rulers, guides, snapping, and configurable stage origin.
- Richer physical fixture symbols and hanging/truss attachment relationships.
- Optional audience/room objects and saved venue templates.

### Programmer / live control

- MainStage-style Performance Surface editor with draggable buttons, faders, knobs, XY pads, banks, and reusable layouts.
- Soft takeover for MIDI faders.
- Relative encoder handling and MIDI feedback.
- Saved-look and exact-cue MIDI assignment.
- Per-show MIDI maps with global fallback.

### Recorder / tracks

- Waveform rendering and editing.
- Count-in.
- Timeline trim.
- Punch-in / overwrite.
- Take duplication.
- Long-recording storage outside browser localStorage.
- Versioned show packages with embedded or referenced media.

### Audio-reactive engine

- Frequency bands.
- Beat/onset detection.
- BPM confidence.
- Audio-to-effect routing.
- Smoothing, hold, release, and calibration.
- Rehearsal recording.

### Output / networking

- Art-Net output driver.
- sACN output driver.
- Production DMXKing / isolated USB-DMX driver.
- Optional direct local WebSocket server for trusted LAN/VPN use.
- Govee / smart-light adapter for scenic non-real-time devices.
- WLED / other LAN-light adapters if retained in the product direction.
- Physical multi-universe output beyond the current Universe 1 uDMX path.

### Fixture system

- Verify starter profiles against official fixture manuals.
- Add a fixture-profile editor/import workflow.
- Expand the real fixture library as hardware is added.
- Physical calibration certification for actual moving fixtures.

### Production readiness

- Export/import shows, stage designs, and versioned backups.
- Crash recovery workflow and tested pre-show checklist.
- Reconnect diagnostics and pre-show health checks.
- Full-screen operator mode and keyboard shortcuts.
- Apple Developer ID signing and notarization so public installs do not require Privacy & Security approval.
- Ableton Link if the final licensing/product direction warrants it.
- Optional richer Max for Live bridge for two-way status / absolute timing.

## Release rule

Feature work stays on branches. Vercel preview deployments are disabled for non-`main` branches, and LumaRig desktop releases are manual-only. Merge to `main` only after CI and visual verification; publish an app version only when the merged build is intentionally ready for installed users.
