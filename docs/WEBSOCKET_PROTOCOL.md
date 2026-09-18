# Remote Control Protocol

The remote controller is a control surface over the existing runtime. It never sends raw DMX and never becomes a state owner.

## Transports

- **Cloud Relay:** implemented with authenticated private Supabase Realtime Broadcast channels. The Mac and remote both create outbound encrypted connections, so they can be on different LANs, mobile networks, or Mac network environments without router port forwarding.
- **Direct WSS:** retained in the PWA for a future local server, trusted VPN, or managed tunnel.

Both transports carry the same logical messages: `state.snapshot`, `state.patch`, `command`, `command.result`, `heartbeat`, and `error`. The cloud relay also uses `state.request` when a newly joined controller needs immediate reconciliation.

## Security boundary

Relay topics are `dmx:<authenticated-user-id>:<room-code>`. Supabase RLS permits authenticated clients to send and receive only under their own user prefix. Clients use only the publishable project key; passwords are used for sign-in and never persisted. Room codes must contain at least 12 characters.

The Mac allow-lists semantic commands such as cue transport, master, blackout, looks, fixture/group attributes, effects, recorder, and sync. Unknown commands and raw-frame writes are rejected.

## State and failure behavior

The Mac publishes throttled revisioned snapshots and responds to explicit state requests. A disconnect affects only the remote surface. Mac playback, MIDI, sync, effects, recording, and physical output continue independently.
