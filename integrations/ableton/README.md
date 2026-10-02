# LumaRig Ableton Live Bridge

This folder is the Max for Live side of the LumaRig Ableton integration.

## What it does

- Reads Ableton Arrangement locators through LiveAPI.
- Mirrors locator names and beat positions to LumaRig.
- Sends Live play/stop, current beat, tempo and time-signature numerator.
- Uses LumaRig's existing semantic WebSocket bridge on `ws://127.0.0.1:47777/studio`.
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

The Max bridge is the Ableton transport authority while it is actively playing. It sends exact musical position at 20 Hz and LumaRig runs those updates through the shared transport engine before rendering Timeline output.

MIDI Clock remains available as a fallback DAW transport, but it should not be armed as a second authority at the same time. The transport engine prevents Ableton, MIDI, Timeline and Studio from fighting over the playhead.

The Max bridge also carries the information MIDI cannot express cleanly: locator names, locator beat positions, Live Set identity and musical transport metadata.

## Failure behavior

If Max, Ableton or the bridge disconnects, LumaRig does not blackout or clear its current output. Local control remains available. The Node bridge retries the local connection every second and drops transport packets while disconnected rather than building a stale queue.
