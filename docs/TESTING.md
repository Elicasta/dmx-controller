# Testing and Verification

## Automated suites

Run:

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

The first runtime package adds tests for:

- 8-bit and 16-bit DMX normalization and splitting
- physical movement range, home, inversion, and calibration offsets
- hanging, floor, and inverted beam transforms
- local Pan/Tilt to world-space ray behavior
- top/front/side projection consistency
- runtime revision and source tracing
- semantic fixture attribute resolution
- virtual and physical output fan-out
- Control Registry command identities and HOLD capability
- inverse target aiming with forward/inverse round-trip verification
- floor, hanging, inverted, and rotated mounting cases
- reachable-range rejection rather than false exactness
- converge, horizontal fan, and vertical fan group targeting
- runtime spatial-target resolution into coarse/fine channels
- calibration recovery for normal, reversed-pan, reversed-tilt, and both-reversed axes
- partial calibration evidence persistence
- semantic and absolute position-palette persistence and version-1 show migration
- exact position-palette recall through the runtime command path
- nearest room-boundary ray intersections and misses
- persisted group reconciliation, assignment, rename, and safe group removal
- fixture-level semantic intensity isolation
- explicit-selection color targeting and empty-selection safety
- profile-aware FX compatibility and ordered group chase targets
- non-destructive group master scaling and exact restoration at 100%
- semantic group color translation
- exact final-frame recorder playback through the output adapter
- Stage Designer pointer unprojection and top/front/side/perspective drag round trips
- private relay configuration validation and authenticated topic isolation

Existing DMX, fixture, look, effect, show, MIDI, and stage tests remain in place.

The console refactor's automated baseline is 79 passing Vitest tests across 18 files. The companion controller has its own protocol suite. Production verification also requires `tsc`, the Vite bundle, Rust tests, and a universal Tauri application bundle.

## Required visual pass

In the running Mac app:

1. Open Fixtures and select a moving-head profile.
2. Enter MOVE mode and drag fixtures and stage objects with both mouse and touch; reload and confirm the edited physical transform persists.
3. Verify perspective, top, front, and side views use the same fixture coordinates.
4. Move Pan coarse and fine, then Tilt coarse and fine; confirm the live degree readout and beam move.
5. Select `AIM`, click Center Stage, Stage Left, Stage Right, and a stage object; confirm the virtual beam and Pan/Tilt readout update from the same runtime frame.
6. Select multiple movers and verify converge, horizontal/vertical fan, mirror, and cross arrangements.
7. Open fixture calibration, send home, capture two or three well-spaced observations, solve, reload, and confirm status/confidence/date persist.
8. Trigger Moving Sweep; confirm the same beam follows it.
9. Load a cue with movement and run GO.
10. Play a recorded take containing movement.
11. Arm external sync and run the assigned take from MIDI transport.
12. Confirm uDMX output continues independently of view changes.

## Physical fixture gate

The package is not physically certified until a real mover is measured, its exact profile verified, and the procedure in `FIXTURE_CALIBRATION.md` is completed. Record the model, mode, throw distance, target points, and observed error.

## Regression rule

Any failure preserves the old stored show/patch data. Do not remove legacy adapters until equivalent tests and a live fixture pass prove the replacement.


## Current show-preflight gate

Before promoting a LumaRig desktop build for live use, run this pass on the actual Mac or Windows machine that will operate the show.

### Playback and Visualizer

1. Build a multi-section Song in Show Creator, open Timeline, stop in a blank/muted area, then return to Creator and press Preview. The Visualizer must immediately show the Creator section and must not remain black.
2. Toggle BLACKOUT on and off several times while moving between Creator, Timeline, Cues, Programmer, and LIVE. Blackout state must follow the runtime command only and release back to the programmed frame.
3. Pop the Visualizer out, move it to the second display, and leave it there while changing workspaces on the main display. The output window must remain responsive and retain the same frame.
4. Run at least one large Show with many cues, multiple FX lanes, video clips, and recorded-take clips. Seek, stop, resume, switch Songs, and reload the app. The same Show must recover without changing cue IDs or media links.

### Screen media

1. Route a Timeline MP4 to a stage screen.
2. Verify Contain and Fill / crop.
3. Change Size, X, and Y framing and confirm the image remains clipped to the physical screen in the embedded Visualizer and pop-out Visualizer.
4. Save/reload the Show and confirm framing persists.
5. Load a still image, solid color, and each test-pattern source on a screen.

### NDI / virtual video input

1. Start NDI Webcam Input / Virtual Input (or another system virtual-camera bridge) before scanning in LumaRig.
2. Press Scan NDI Webcam / Video Inputs.
3. On first use, approve LumaRig camera access when macOS or Windows asks.
4. If permission was previously denied, use Open Camera Privacy Settings, allow LumaRig, quit/reopen LumaRig, and press Retry Video Input Scan.
5. Route the discovered virtual input to a screen and verify live motion in both embedded and pop-out Visualizer views.
6. Stop the virtual input and confirm LumaRig reports the source unavailable without crashing or blacking out lighting.

LumaRig currently discovers NDI through an operating-system virtual video input. This test does not imply raw NDI network-source discovery.

### Timeline editing

1. Move the Track height slider between Compact, Normal, and Tall.
2. Confirm AUDIO, VIDEO, TAKE, and all FX lanes resize together.
3. Reload LumaRig and confirm the chosen height persists.
4. Drag and resize clips at each height and confirm pointer hit targets remain usable.
5. Open Step Editor directly from a linked Timeline lighting clip and confirm saved FX can be selected as per-step triggers.

### Ableton Live / Max bridge

1. Add the LumaRig Ableton Bridge Max-for-Live device to an Arrangement Set.
2. Create named Arrangement locators, including a Set using a non-4/4 meter such as 6/8 or 7/8.
3. Confirm the Ableton Live · Max Bridge card reports LINKED and the locators appear on both LumaRig Timeline surfaces.
4. Start, stop, seek, and jump between locators in Ableton. LumaRig should follow musical position through the shared Transport Engine while retaining cue/FX/video/DMX authority.
5. Verify the Lighting Advance / Delay offset is applied.
6. If LumaLive is also connected to Ableton, confirm Connection Manager shows both Ableton Live · Max Bridge and Ableton via LumaLive as separate connections and only one source owns transport at a time.
7. Remove/disable the Max device while a lighting frame is active. The bridge should time out and release Ableton transport authority without forcing blackout or clearing the current live frame.

### Physical output and touch

1. Connect the actual uDMX/DMX interface and at least one representative fixture from the show.
2. Run Programmer values, Creator Preview, Timeline playback, GO cues, LIVE overrides, blackout/release, and a recorded take against physical output.
3. Disconnect/reconnect the DMX interface and confirm the local Show and Visualizer continue operating.
4. Exercise the primary LIVE and Timeline controls with touch hardware where available.
5. Leave the full show running long enough to exercise repeated video, cue, FX, transport, Cloud/remote reconnect, and second-display operations without restarting the app.
