# Console UI Redesign Audit

## Existing application

- **Frontend:** React 19 + TypeScript + Vite. `src/main.tsx` mounts the single `App` component; `src/App.tsx` currently contains the application orchestration and all five legacy workspace views.
- **Legacy workspaces:** Live, Show, Fixtures, Connect, and Settings are selected by local React state. There is no routing library.
- **Authoritative live state:** `ShowRuntime` owns active universe frames, patch selection, master/blackout command state, revision, and channel source trace. React mirrors the emitted frame for rendering.
- **Command boundary:** semantic fixture controls, target aiming, cue/MIDI actions, and compatibility full-frame producers converge through `ControlCommand`. The existing `commitUniverse` function is the compatibility adapter for cues, fades, FX, recorder, audio, and sync.
- **Output path:** `ShowRuntime` produces a finished frame, `OutputRouter` sends the identical frame to `VirtualOutputDriver` and the uDMX callback adapter. Physical output is skipped while uDMX is disconnected.
- **Fixture model:** `FixtureProfile` owns modes, semantic channel parameters, movement geometry, and optics. `PatchedFixture` is the show instance with universe/address/group, transform, mounting, orientation, and calibration.
- **Effects:** `renderEffect` is the established timed DMX producer. Press/release state for Blinder and Bump is centralized in the application orchestration and shared by mouse and MIDI.
- **Cues and recordings:** cues store exact universe snapshots with legacy look metadata; recorded takes store changed-channel frames at 20 Hz. Existing fade, cue progression, playback, and DAW transport functions remain authoritative.
- **Stage:** meter-based stage geometry, orthographic/perspective projection, forward beam rays, inverse targeting, calibration, position palettes, and room intersections already share the fixture/runtime state.
- **MIDI:** Core MIDI is exposed by Tauri. The existing assigner reads the shared Control Registry and handles note, CC, transport, clock, and song-position input.
- **Persistence:** versioned patch, stage, and show data plus looks, mappings, and settings are stored in browser local storage. Migrations create backup keys before replacing legacy documents.
- **Native bridge:** Tauri commands expose uDMX discovery/connect/output/blackout/status and MIDI discovery/connect/event draining. Rust owns the 40 Hz uDMX output thread and USB lifecycle.
- **Tests:** Vitest covers DMX, profiles, effects, looks, show data, MIDI, runtime, routing, stage geometry, targeting, calibration, palettes, and intersections. Rust tests cover USB protocol/ranges and MIDI parsing.

## Redesign boundaries

The console redesign is a view-layer replacement. It will not create a second universe, effect scheduler, cue transport, fixture library, calibration model, or native connection path.

```text
new console workspaces
        │
        ▼
console selectors / view models
        │
        ▼
existing ControlCommand + orchestration adapters
        │
        ▼
ShowRuntime → OutputRouter → Virtual / uDMX
```

The four visible workspaces become Setup, Program, Show, and Live. Connection and engineering controls move under Setup without removing their existing handlers. Fixture selection stays on `PatchedFixture.selected`, so Setup Stage, Program Stage, fixture faders, group operations, MIDI, and effects see the same selection.

## Necessary domain additions

1. Persist group definitions separately from temporary UI state while retaining the current fixture `group` reference for backward compatibility.
2. Add one console selector module for group inference, capability checks, selected targets, semantic intensity/color values, and effect compatibility.
3. Add one non-destructive group-master runtime layer. It must scale resolved dimmer output without rewriting fixture base values.
4. Add UI-only workspace preferences with safe defaults; do not persist transient fixture selection.

## Implementation sequence

1. Add and test group persistence/migration, selectors, batch patch validation, and group-master resolution.
2. Extract reusable console primitives (browser rows, color control, fixture/group faders, FX buttons, status/header).
3. Replace legacy top navigation with the four-workspace shell.
4. Move all existing Setup/connection/calibration functions into Setup subviews.
5. Wire Program fixture/group/stage modes to existing semantic controls and shared selection.
6. Recompose cue and track tools into Show; build a fixed-height performance Live view.
7. Run interaction tests, full Vitest/Rust suites, production frontend build, Tauri bundle, and visual inspection without connecting physical DMX.

## Known safety constraints

- Empty selection never implies all fixtures; “All Fixtures” must be an explicit target.
- Unsupported semantic attributes and effects are omitted/disabled, never guessed.
- Global blackout remains one header control and retains the native engine’s non-destructive behavior.
- UI render timing never drives the Tauri output thread.
- Existing storage keys and migrations remain readable throughout the redesign.
