# LumaRig 3.0: Super Scene + QLC+ Integration

## Why this direction

Keep LumaRig's song-first workflow and application identity. Use Daslight 5 as inspiration for clear effects, readable labels, and multitrack scene composition. Do not copy Daslight assets or proprietary code. QLC+ is an **optional** engine integration, not a forced replacement for the working native engine.

### Implemented in the first branch

- Timeline library has searchable FX cards with Dimmer, Color, Movement, Chase, and Custom categories.
- FX cards show their names, purpose, waveform/motion, and beat cycle.
- Existing recipe IDs and persisted show formats are unchanged.
- Original drag/drop and playhead insertion routes remain.
- Timeline heading uses the Super Scene terminology; it already supports independent lane clips linked by cue ID.
- Add a documented QLC+ 5 WebSocket protocol adapter with checked commands and feedback parsing.
- Add a QLC+ connection tester under **BUILD → Connections**: manual connect/disconnect, project presence, function discovery, and explicit start/stop controls. It blocks these controls while native uDMX is connected.
- The adapter defaults to localhost, requires an explicit connection, and does not run by default.
- Momentary button holds are released on planned disconnect or reconnection; persistent fader levels are not treated as momentary holds.

### Verified upstream control protocol

QLC+ 5 web interface documentation:
https://docs.qlcplus.org/v5/advanced/web-interface/web-api

Start QLC+ locally with `-w`, create a show with mapped functions or Virtual Console widgets, and connect to:
`ws://127.0.0.1:9999/qlcplusWS`.

Samples:
- `QLC+API|setFunctionStatus|7|1` starts function 7.
- `QLC+API|setFunctionStatus|7|0` stops function 7.
- `12|255` sets widget 12 to 255.
- `18|NEXT` advances cue list widget 18.
- `GM_VALUE|0` sets QLC+'s Grand Master to zero.

**Important**: The Connections tester uses the typed adapter, but this is **not yet connected** to LumaRig's running output pipeline, show patches, Supabase PWA, or Live controller. Those require a real QLC+ install, functions/widget mapping, lifecycle management, authentication policy and end-to-end tests. This PR does not claim physical fixture compatibility.

### Safety rules before live DMX tests

1. Use a separate bench fixture or virtual QLC+ output for the first integration pass. Do **not** let QLC+ and native LumaRig drive the same physical universe simultaneously.
2. Use QLC+ project authentication if the web service is available to other machines. The initial adapter permits only loopback URLs.
3. Keep the native output engine selected until physical tests validate fixture profiles, dimmer/color/movement priority, reconnect behavior and blackout.
4. Stop must mean stop. Do not queue or replay lighting commands after a dropped connection.
5. For remote controllers, place an authenticated local bridge between Supabase and the QLC+ socket. Do not expose QLC+'s WebSocket to the public internet.
6. Compare QLC+ distribution and transitive licensing before shipping its binary with LumaRig; this branch embeds no QLC+ source.

## Follow-up implementation order

1. **QLC+ diagnostics improvements**: add widget discovery and binding validation, live function status and reconnect telemetry to the initial manual tester.
2. **Engine abstraction**: map LumaRig commands to native or QLC+ backend with exclusive per-universe output ownership.
3. **Two-way controls**: bind iPad/PWA scene buttons, faders, momentary bumps and blackout, ensure safe releases after disconnect.
4. **Super Scene library**: preserve compositions as portable, versioned, cue-linked arrangements inside the show file, with duplicate, rename, rollback and cross-song reference validation.
5. **FX designer**: parameter curves, multi-layer FX, phase/rate controls, consistent fixture grid and song tempo overrides.
6. **Native QLC+ packaging**: evaluate upstream fork only after the simpler external adapter passes functional and licensing review.

## Testing

```bash
npm ci
npm test
npm run build
npm run test:ui
cargo test --manifest-path src-tauri/Cargo.toml
```

Hardware smoke test must also check no double-output, rapid slider changes, dead network, reconnect, scene edits while playing, stop, blackout and release of held bumps.


## Delivered in the next implementation pass

### Reusable Super Scenes

In **SHOW → Timeline**, the Super Scenes bar saves the lighting clips in the
currently active timeline under a name. Saved scenes contain *linked cue IDs*
and relative positions, not copied DMX fixture instructions. Edits to a source
cue are reflected in every inserted instance. Super Scenes are stored as
`show.superScenes`, validated on import and retained during save sanitation.
They are show-local and can be reused across song timelines sharing that show.

- **Save composition**: save existing lighting clips under a unique name.
- **Insert at playhead**: append cloned timeline clip identities, keeping the
  source cues linked.
- **Replace lighting**: replace the lighting clips only; preserve audio,
  video and recorded takes.
- **Rename / Delete**: manage the saved preset without affecting existing
  inserted clips.
- Invalid cue dependencies and excessive clip counts reject the operation
  instead of silently emitting missing or wrong lights.

### QLC+ as a selectable physical output transport

LumaRig's current engine computes lighting exactly as before. The optional
`QlcOutputDriver` sends only changed 1-based Simple Desk channels over the
documented QLC+ v5 WebSocket API. It uses a 25 ms coalescing flush, bounded
at 128 channel messages per tick. It does not claim to compile, embed, fork,
or redistribute the QLC+ engine; it uses an installed QLC+ process.

To enable:

1. Install QLC+ 5 on the **same desktop computer** and configure the
   correct output fixture universe/interface in QLC+.
2. Load a QLC+ workspace file (`.qxw`) and enable its web interface (`-w`).
   Secure the web interface and do not expose the socket to the internet.
3. Ensure the original LumaRig uDMX is **disconnected**. Keep any separate
   Art-Net physical routes disabled unless deliberately isolated.
4. In **BUILD → Connections → QLC+ 5 Output**, click **Connect local QLC+**.
   The panel verifies an active QLC+ project.
5. Click **Arm QLC+ Output**. Grand Master stays muted until all 512 channels
   have been written; the driver then enables playback through QLC+.
6. Use existing Live desk, Song timeline, Ableton commands, and paired
   Supabase PWA. They continue to use LumaRig's single control dispatcher.
7. Select **Disarm + QLC Blackout** to zero QLC+'s Grand Master; disconnect
   when switching back to uDMX.

QLC+ is a separate process. If it crashes or the WebSocket drops, LumaRig
disarms and will not replay lighting until the operator explicitly reconnects
and arms. The fixtures may preserve the last output; a hard failure cannot
promise a physical blackout. Always have physical e-stop/blackout procedures.

**Do not use QLC+ scenes and LumaRig Simple Desk streaming on the same
universes simultaneously.** The arming procedure stops known QLC+ functions,
but the operator must not restart those functions during external output
control. The QLC+ *full editing/FX engine* has not been embedded in LumaRig.
This release adds QLC+ output-device choice and the LumaRig Super Scene UI,
not a finished upstream C++ Qt fork.

### PWA compatibility

`Elicasta/mycontroller` uses the same authenticated Supabase Realtime relay.
No client-side access to QLC+'s local WebSocket and no router port forwarding
are required. The companion PR optionally displays `outputEngine: 'QLC+'`
in its status bar. Its control commands remain unchanged.

### Acceptance gates before merging or making a signed release

- CI green: Vitest, TypeScript/Vite build, Rust, Playwright.
- Confirm 1-based channels, fixture address patch, and correct output
  through a *real* licensed/compatible USB or network DMX interface.
- Confirm both master and blackout, flash release, stop, DMX channel changes,
  cross-song Super Scene reuse, and cloud PWA latency/connection recovery.
- Verify QLC+ Simple Desk and native LumaRig do not compete for the same
  physical universe. Test operating-system shutdown, Wi-Fi loss and reconnect.
- Verify the relevant QLC+ version/protocol on macOS and Windows.
