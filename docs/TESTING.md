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
