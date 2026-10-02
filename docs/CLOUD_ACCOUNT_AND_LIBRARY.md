# LumaRig Account, Cloud Library, and Controller Pairing

## Operating model

LumaRig remains local-first. The signed-in account adds sync and remote access, but live lighting, local Show saves, media playback, and DMX output do not depend on the internet.

One permanent Supabase account owns:

- Cloud Shows
- Cloud Song Library documents
- Song metadata: title, artist, BPM, musical key, arrangement, notes
- recorded-take labels and Song/Show assignment
- paired controller device grants

The desktop stores the normal Supabase session after the first successful sign-in. The password is not written into LumaRig settings.

## Desktop sign-in

Connect > LumaRig Cloud exposes the normal account sign-in.

After sign-in LumaRig:

1. restores the permanent account session on later launches,
2. creates a private relay-room identifier when the computer does not already have one,
3. connects the private remote relay,
4. loads Cloud Shows and Cloud Songs,
5. subscribes to Cloud Library changes,
6. makes QR/six-digit controller pairing available.

The Supabase project URL, publishable key, and private relay room remain under Advanced Cloud Connection for support/debugging.

## Online library

The web remote provides /account and /library routes.

Authenticated users can edit:

- Song title
- artist
- BPM
- musical key
- arrangement order
- Song notes
- Show title/status
- recorded-take label
- recorded-take Song assignment
- recorded-take Show assignment

Song edits use optimistic revisions. If the cloud Song changed elsewhere, the desktop pulls the latest cloud version rather than silently overwriting it.

## Song synchronization

A saved desktop Song Program is stored locally first. When signed in, LumaRig also writes its Song document to the cloud.

Cloud Song metadata is overlaid onto the validated Song Program when downloaded. Matching Songs already inside the active Show are updated by library identity.

Media remains governed by the local/cloud media system. Metadata sync does not make live playback network-dependent.

## Controller pairing

Account login and controller pairing are different trust levels.

- Desktop: permanent signed-in account.
- Web library: permanent signed-in account in its own browser auth storage.
- iPad controller: anonymous Supabase Auth session with a revocable device grant.

The paired-controller auth storage is intentionally separate from the web-library account auth storage, so signing into the online library cannot replace or corrupt the controller's anonymous device identity.

A QR link contains a six-digit code plus a high-entropy token. Manual six-digit entry is the fallback. The pairing window is short-lived and single-use.

## Portable files

Offline portability remains available alongside Cloud:

- .lumarigsong: one reusable Song Program plus only the media it references
- .lumarigshow: one complete Show snapshot plus only the media it references
- .lumarigbackup: full local LumaRig workspace/library backup plus referenced media

Mac and Windows use the same formats.
