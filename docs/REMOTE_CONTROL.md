# Remote Control

The web controller is a control surface, not an output engine. The LumaRig desktop app remains authoritative:

```text
Vercel PWA → private relay → ControlCommand → ShowRuntime → OutputRouter → uDMX
```

## Cross-network relay

The implemented relay uses Supabase Realtime Broadcast because both devices establish outbound encrypted WebSocket connections. It therefore works across separate LANs and mobile networks without opening an inbound port on the show computer.

Production channels are private and authenticated. Both devices sign into the same operator account and join a topic shaped as `dmx:<auth-user-id>:<room-code>`. Realtime RLS policies allow that authenticated user to send and receive Broadcast messages only under their own user-id prefix. Disable public channel access in Supabase Realtime Settings.

Use only the project publishable key in clients. Never enter a Supabase secret or service-role key. The relay account password is used for sign-in and is not persisted in DMX Controller settings.

## Message flow

The desktop app publishes throttled `state.snapshot` messages containing cue, fixture, selection, master, blackout, effects, sync, recorder, and output health state. The PWA requests a fresh snapshot after joining. Commands are returned as typed semantic actions and pass through the existing application adapters and ShowRuntime. Raw-frame commands are rejected by the remote boundary.

Momentary controls publish distinct `effect.press` and `effect.release` commands. The PWA also releases held controls on pointer cancellation, app blur, and screen lock.

## Failure behavior

- Relay loss never stops cues, FX, recorder, MIDI, sync, or DMX on the desktop app.
- A disconnected controller cannot send commands.
- Invalid or unsupported commands return `command.result` errors.
- The app does not auto-connect uDMX when the relay starts.
- Blackout and grand-master semantics remain non-destructive.

## Provisioning

The companion repository contains `supabase/realtime-policies.sql`. Run it in the Supabase SQL editor, disable Realtime public access, create one operator account, then enter the same project URL, publishable key, account, and room code in both applications.

The Windows and macOS installers use the same relay implementation and Connections form. A fresh Windows installation has its own local settings and authenticated session: enter the same project URL, publishable key, operator email, and room code used on the Mac, then sign in with the operator password. The app stores the non-password settings on that computer and never bundles the account password. The project URL and publishable key may also be supplied at build time as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; neither is required when configuring the connection in the app.
