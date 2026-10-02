# Remote Control

The web controller is a control surface, not an output engine. The Mac remains authoritative:

```text
LumaRig Remote → private relay → ControlCommand → ShowRuntime → OutputRouter → uDMX
```

## Cross-network relay

The relay uses Supabase Realtime Broadcast. Both devices establish outbound encrypted WebSocket connections, so separate LANs and mobile networks do not require an inbound port on the show Mac.

The Mac signs in with the permanent operator account and joins:

```
dmx:<operator-user-id>:<room-code>
```

An iPad should not receive that operator password. LumaRig instead creates a two-minute, single-use pairing session:

- QR: six-digit code plus a 256-bit random token in the LumaRig Remote URL.
- Manual fallback: six-digit code only.
- The PWA creates an anonymous Supabase Auth user and inserts a pairing claim.
- Database RLS/trigger logic maps that device user to the operator and relay room.
- Realtime RLS permits the paired device to join only that mapped private topic.
- Revoking the device row denies future channel authorization.

Anonymous controller identities use Supabase's `authenticated` database role, but Cloud Shows, media, and operator-owned tables explicitly deny anonymous users.

Disable **Realtime → Allow public access**. Enable **Auth → Anonymous Sign-Ins** for pairing.

Use only the project publishable key in clients. Never use a secret or service-role key. The Mac operator password is used only for Auth sign-in and is not written into LumaRig settings.

## Message flow

The Mac publishes throttled `state.snapshot` messages containing cue, fixture, selection, master, blackout, effects, sync, recorder, and output health state. The PWA requests a fresh snapshot after joining. Commands return as typed semantic actions through the same ShowRuntime path used by the desktop controller. Raw-frame commands are rejected at the remote boundary.

Momentary controls publish distinct `effect.press` and `effect.release` commands. The PWA also releases held controls on pointer cancellation, app blur, and screen lock.

## Failure behavior

- Relay loss never stops cues, FX, recorder, MIDI, sync, or DMX on the Mac.
- A disconnected or revoked controller cannot create new authorized relay subscriptions.
- Invalid or unsupported commands return `command.result` errors.
- The app does not auto-connect uDMX when the relay starts.
- Blackout and grand-master semantics remain non-destructive.
- Cloud Show or Storage failures do not roll back a successful local Show save.

## Provisioning

The companion `Elicasta/mycontroller` repository contains the canonical migration:

```
supabase/cloud-shows-pairing.sql
```

Apply it to the exact Supabase project configured by the production remote, enable Anonymous Sign-Ins, disable Realtime public access, and create one permanent operator account for the Mac.

The older `supabase/realtime-policies.sql` file remains as a relay-only compatibility migration and assumes `lumarig_controller_devices` already exists.
