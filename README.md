# DMX Controller for Mac — uDMX Test Build

Milestone 1 proves one physical path before fixture profiles or show programming are added:

**React UI → Tauri → Rust lighting/output worker → direct USB control transfer → Anyma uDMX → DMX512 fixture**

This build is specifically for the **www.anyma.ch uDMX** test interface. It no longer uses serial ports or the ENTTEC/DMXKing protocol.

## What is implemented

- macOS USB discovery for the original Anyma uDMX identity
- support for original `16C0:05DC` and a known compatible `16C0:05E4` ID, with descriptor verification
- direct vendor USB control transfers using the published uDMX protocol
- 512-channel universe in memory
- host-side updates coalesced to at most 40 Hz so rapid slider moves do not flood USB
- single-channel writes when one channel changes
- contiguous range writes when several channels change together
- raw controls for channels 1–16
- blackout that sends physical zeroes while preserving programmed values
- release-blackout restores programmed values
- disconnect and normal app shutdown attempt to zero all 512 channels first
- USB write/channel counters and output-loss reporting
- hardware output trait so a future isolated interface can be added without rewriting the lighting engine
- Rust unit tests for protocol boundaries/identity helpers and dirty-range behavior
- TypeScript tests for DMX value helpers

## Protocol used

The original uDMX firmware exposes vendor-specific USB requests:

- request `1`: set one channel
  - `wValue` = value `0..255`
  - `wIndex` = zero-based channel `0..511`
- request `2`: set a consecutive channel range
  - `wValue` = number of channels
  - `wIndex` = zero-based first channel
  - USB payload = channel bytes

The USB request type is vendor + device + OUT (`0x40`). The controller UI remains 1-based, so UI channel 1 is protocol index 0.

The firmware keeps its own 512-byte DMX buffer and generates the DMX signal. The Mac only sends new values when they change.

## First run on your Mac

### 1. Hardware

1. Plug the Anyma uDMX into the Mac.
2. Connect its DMX output to **one fixture**.
3. Set the fixture to a known DMX mode.
4. Set the fixture start address to **001** for the first test.
5. Do not run another lighting program against the uDMX at the same time.

This particular uDMX design is not galvanically isolated. Use it for this bench test, not as the interface we standardize on for live production.

### 2. Confirm macOS sees it

From this project folder:

```bash
./scripts/check-udmx-macos.sh
```

For an original Anyma unit, expect something equivalent to:

```text
Vendor ID:   0x16c0
Product ID:  0x05dc
Manufacturer: www.anyma.ch
Product:      uDMX
```

### 3. Development prerequisites

Install Apple's command-line tools if needed:

```bash
xcode-select --install
```

Install Rust using rustup, then confirm:

```bash
rustc --version
cargo --version
node --version
npm --version
```

The Rust `rusb` dependency uses its vendored libusb build, so this project does **not** require a separate Homebrew libusb package for the app itself.

### 4. Install and run

```bash
npm install
npm run tauri:dev
```

### 5. Physical output test

1. Click **Scan USB**.
2. Verify the app shows **Anyma uDMX** and `16C0:05DC` (or a verified compatible unit).
3. Click **Connect uDMX**.
4. Keep all values at 0.
5. Move CH 1 from 0 toward 255.
6. If the fixture does nothing, reset CH 1 to 0 and test CH 2, then CH 3, following the fixture's DMX chart.
7. Test **BLACKOUT**. Physical output should go to 0 while the fader values stay unchanged.
8. Release blackout. The previous values should return.
9. Click **Disconnect + Zero Output**. The fixture should go dark before the USB handle closes.

## Failure behavior

- App starts with all channels at 0.
- A USB write error marks output offline and stops issuing further writes.
- Disconnect and normal shutdown try to send 512 zeroes first.
- A hard process crash cannot guarantee a final blackout command. The uDMX firmware can continue outputting its last buffered values while it remains powered. Treat the physical fixture power/DMX path as the final safety control during testing.
- Because the original uDMX VID/PID is a shared USB ID, the backend verifies the manufacturer/product descriptor before enabling Connect. This avoids blindly sending vendor commands to another device that happens to use the same shared ID.

## Tests

Frontend helpers:

```bash
npm test
```

Rust backend:

```bash
cd src-tauri
cargo test
```

## Output architecture

The app now has a hardware boundary:

```text
Lighting engine
      ↓
DmxOutput trait
      ↓
Anyma uDMX driver   ← current test driver
      ↓
DMX512
```

A future isolated interface becomes another `DmxOutput` implementation. Patch, groups, scenes, cues, fades, and the live UI will not care which output driver is active.

## Next milestone

Do not build fixture profiles until this test passes on the real light.

After physical output works:

1. fixture profile schema
2. patching + address collision detection
3. fixture/groups programmer
4. looks
5. fades
6. cues + GO
7. local iPad/iPhone remote


## Desktop releases and self-updates

Release builds use Tauri's signed updater. The source repository stays private while signed installers and `latest.json` are published to the public `Elicasta/dmx-controller-releases` repository so installed Macs can check for updates without GitHub credentials.

See [docs/RELEASING.md](docs/RELEASING.md) for the one-time GitHub secret setup, the first updater-enabled install, and the no-Terminal release flow.
