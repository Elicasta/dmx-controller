# LumaRig Studio Bridge

The Studio bridge is a semantic show-control API. Studio does not own DMX and never sends raw universes.

## Transport priority

1. Loopback WebSocket when Studio and LumaRig run on the same machine.
2. Existing authenticated Supabase relay for remote networks.
3. Authenticated LAN discovery later, only after the bridge token/session handshake is implemented.

All transports carry the same command envelope and result format.

## Song/show recall

Studio identifies both its current Studio Show and stable Song ID. LumaRig resolves an exact show binding first, then a reusable Song binding. If no binding exists and `createIfMissing` is true, LumaRig creates a lighting show and returns its stable ID.

## Commands

hello, song.resolve, show.load, cue.go, scene.fire, fx.start, fx.stop, record.start, record.stop, record.play, record.stopPlayback, blackout, transport.

The bridge handler must dispatch into the existing ShowRuntime/recording paths. It must not create a second lighting runtime.

## Discovery

The current native bridge listens only on `127.0.0.1`. It is intentionally not exposed to the LAN without authentication. A future LAN mode must implement the bridge token/session handshake before binding to non-loopback interfaces.

## Failure behavior

A Studio disconnect never stops LumaRig output. LumaRig keeps its current state and remains locally operable. Studio reports degraded lighting while audio continues.
