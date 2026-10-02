# LumaRig Ableton Live Bridge

This folder is the Max for Live side of the LumaRig Ableton integration.

## What it does

- Reads Ableton Arrangement locators through LiveAPI.
- Mirrors locator names and beat positions to LumaRig.
- Sends Live play/stop, current beat, tempo and time-signature numerator.
- Uses LumaRig's existing semantic WebSocket bridge on `127.0.0.1:47777`.
- Never sends DMX. LumaRig remains the lighting authority.

## Install for development

1. Install Max for Live / Max.
2. In this folder run `npm install` once so Node for Max can load the `ws` package.
3. Open `LumaRig Ableton Bridge.maxpat` in Max.
4. Save it into your Max for Live MIDI Effects folder as an `.amxd` device.
5. Drop the device on one MIDI track in the Ableton Set.
6. Launch LumaRig from `feature/ableton-live-integration`.
7. In Ableton Arrangement View create locators such as `INTRO`, `VERSE 1`, `CHORUS`, `BRIDGE`.
8. Open LumaRig Show > Timeline or Show > Sync. The locators should appear on the Timeline ruler and the Live section should update as transport moves.

## Timing

The Max device sends exact musical position as a drift correction. For the tightest live timing, also route Ableton MIDI Clock/Transport into LumaRig's MIDI input. LumaRig already understands MIDI Clock, Start, Continue, Stop and Song Position.

The Max bridge carries the information MIDI cannot express cleanly: locator names, locator beat positions, Live Set identity and musical transport metadata.

## Failure behavior

If Max, Ableton or the bridge disconnects, LumaRig does not blackout or clear its current output. Local control remains available. The Node bridge retries the local connection every second and drops transport packets while disconnected rather than building a stale queue.
