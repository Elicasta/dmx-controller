# LumaRig Studio Bridge

The Studio bridge is a semantic show-control API. Studio does not own DMX and never sends raw universes.

## Transport priority

1. Loopback discovery when Studio and LumaRig run on the same machine.
2. LAN discovery and direct WebSocket.
3. Existing authenticated Supabase relay for remote networks.

All transports carry the same command envelope and result format.

## Song/show recall

Studio identifies both its current Studio Show and stable Song ID. LumaRig resolves an exact show binding first, then a reusable Song binding. If no binding exists and `createIfMissing` is true, LumaRig creates a lighting show and returns its stable ID.

## Commands

hello, song.resolve, show.load, cue.go, scene.fire, fx.start, fx.stop, record.start, record.stop, record.play, record.stopPlayback, blackout, transport.

The bridge handler must dispatch into the existing ShowRuntime/recording paths. It must not create a second lighting runtime.

## Discovery

The native bridge server will advertise `_lumarig._tcp` and listen on loopback/LAN. Studio should prefer 127.0.0.1 when present. A bridge token/session handshake is required before accepting control from LAN peers.

## Failure behavior

A Studio disconnect never stops LumaRig output. LumaRig keeps its current state and remains locally operable. Studio reports degraded lighting while audio continues.
