# Cloud Shows

LumaRig Cloud Shows is an additive sync layer. The local transactional Show checkpoint remains the first and authoritative save for live operation.

## Save order

1. LumaRig commits the Show snapshot to the local IndexedDB program checkpoint.
2. Referenced Song Bank media is checked in the private `lumarig-show-media` Supabase Storage bucket. Existing immutable `mediaId` objects are skipped.
3. LumaRig calls `lumarig_save_show` with the last cloud revision it knows.
4. Supabase accepts the write only when that expected revision is still current.
5. The database records an immutable version row.

A cloud failure never rolls back a valid local save. A revision conflict never silently overwrites the copy saved by another computer.

## Cloud folders

Folders live in `lumarig_show_folders`. Shows use a composite owner/folder foreign key so a Show cannot be attached to another user's folder.

The current desktop UI exposes Cloud Root plus top-level folders. The schema already supports parent folders for a later nested browser without requiring a migration.

## Media

Song and MP4 media referenced by a Show is stored privately at:

```
<operator-user-id>/<show-id>/<media-id>
```

The media ID is generated when a file is attached in Song Bank, so the object is treated as immutable. Opening a Cloud Show on a new Mac downloads those blobs into the local `lumarig-song-media` IndexedDB before loading the Show.

Paired anonymous controller users cannot read Cloud Shows or media.

## Failure behavior

- Supabase offline: local Show save succeeds; Cloud Shows reports the sync error.
- Media missing locally: local Show save succeeds; cloud sync stops before updating the cloud document.
- Cloud revision changed elsewhere: local Show save succeeds; cloud write returns a conflict and the newer cloud copy is preserved.
- Controller pairing/realtime failure: DMX output and all local control paths continue.
- Cloud media download failure: the cloud Show is not promoted into the local library as a complete download.

## Backend migration

The shared migration lives in the companion `Elicasta/mycontroller` repository:

```
supabase/cloud-shows-pairing.sql
```

Apply it to the same Supabase project used by the production LumaRig Remote. Enable Auth Anonymous Sign-Ins and disable Realtime public access before using QR/six-digit controller pairing.

Never put a Supabase secret/service-role key in LumaRig or the web controller. Both clients use the project publishable key plus Auth and RLS.
