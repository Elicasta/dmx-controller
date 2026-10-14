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

**Important**: The typed adapter is available for integration work but is **not yet connected** to LumaRig's running output pipeline, show patches, Supabase PWA, or Live controller. Those require a real QLC+ install, functions/widget mapping, lifecycle management, authentication policy and end-to-end tests. This PR does not claim physical fixture compatibility.

### Safety rules before live DMX tests

1. Use a separate bench fixture or virtual QLC+ output for the first integration pass. Do **not** let QLC+ and native LumaRig drive the same physical universe simultaneously.
2. Use QLC+ project authentication if the web service is available to other machines. The initial adapter permits only loopback URLs.
3. Keep the native output engine selected until physical tests validate fixture profiles, dimmer/color/movement priority, reconnect behavior and blackout.
4. Stop must mean stop. Do not queue or replay lighting commands after a dropped connection.
5. For remote controllers, place an authenticated local bridge between Supabase and the QLC+ socket. Do not expose QLC+'s WebSocket to the public internet.
6. Compare QLC+ distribution and transitive licensing before shipping its binary with LumaRig; this branch embeds no QLC+ source.

## Follow-up implementation order

1. **QLC+ diagnostics panel**: connect/disconnect, project state, discover functions and widgets, validate bindings, track status.
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
