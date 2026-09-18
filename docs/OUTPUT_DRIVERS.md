# Output Drivers

`OutputRouter` receives one finished universe frame and fans it out to registered drivers.

Current drivers:

- `VirtualOutputDriver`: always receives and retains the latest frame. Tests and visualization can run without hardware.
- uDMX callback adapter: sends Universe 1 to the existing Tauri/Rust uDMX implementation only while connected.

The Rust backend already isolates USB behavior behind its `DmxOutput` trait and continues its independent 25 ms transmission loop. Fixture geometry never imports or calls uDMX directly.

Future Art-Net and sACN drivers must implement the same finished-frame contract. A failure in a network or remote-control surface must not stop the runtime or other outputs.

## Timing boundaries

- DMX hardware loop: driver-specific; current uDMX target is 40 Hz.
- Recorder sampling: existing 20 Hz changed-channel format.
- Stage rendering: browser animation/UI cadence.

These loops observe the same runtime state but do not clock one another.
