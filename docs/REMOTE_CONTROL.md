# Remote Control

The web controller is a control surface, not an output engine. The Mac remains authoritative:

```text
Vercel PWA → private relay → ControlCommand → ShowRuntime → OutputRouter → uDMX
```

## Cross-network relay

The implemented relay uses Supabase Realtime Broadcast because both devices establish outbound encrypted WebSocket connections. It therefore works across separate LANs, mobile networks, and Mac network environments without opening an inbound port on the show Mac.

Production channels are private and authenticated. Both devices sign into the same operator account and join a topic shaped as `dmx:<auth-user-id>:<room-code>`. Realtime RLS policies allow that authenticated user to send and receive Broadcast messages only under their own user-id prefix. Disable public channel access in Supabase Realtime Settings.

Use only the project publishable key in clients. Never enter a Supabase secret or service-role key. The relay account password is used for sign-in and is not persisted in DMX Controller settings.

## Message flow

The Mac publishes throttled `state.snapshot` messages containing cue, fixture, selection, master, blackout, effects, sync, recorder, and output health state. The PWA requests a fresh snapshot after joining. Commands are returned as typed semantic actions and pass through the existing application adapters and ShowRuntime. Raw-frame commands are rejected by the remote boundary.

Momentary controls publish distinct `effect.press` and `effect.release` commands. The PWA also releases held controls on pointer cancellation, app blur, and screen lock.

## Failure behavior

- Relay loss never stops cues, FX, recorder, MIDI, sync, or DMX on the Mac.
- A disconnected controller cannot send commands.
- Invalid or unsupported commands return `command.result` errors.
- The app does not auto-connect uDMX when the relay starts.
- Blackout and grand-master semantics remain non-destructive.

## Provisioning

The companion repository contains `supabase/realtime-policies.sql`. Run it in the Supabase SQL editor, disable Realtime public access, create one operator account, then enter the same project URL, publishable key, account, and room code in both applications.
