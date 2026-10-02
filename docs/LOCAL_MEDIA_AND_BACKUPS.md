# Local Media Library + Portable Backups

LumaRig keeps show programming independent from the browser/WebView cache.

## Storage model

The installed macOS and Windows app keeps a native media registry under the app's local-data directory.

- **Managed copy**: LumaRig copies the selected file into its own media store. Moving or deleting the original file does not affect the Show.
- **Reference in place**: LumaRig stores the external file path and reads that file directly. If the file moves, the asset remains in Media Library as **Missing** until it is relinked.
- **Browser compatibility cache**: Song Bank still writes its IndexedDB media cache. On desktop, the same import also gets a native managed copy. Old IndexedDB-only assets are promoted to native storage automatically before portable-backup export.

Media IDs are stable identities. Relinking a missing asset keeps its ID so Songs, timelines, Cloud Shows, and recordings do not have to be rewritten.

## Library folders

Folders are persistent logical library folders with parent/child relationships. Assets can be moved between folders without changing media IDs.

Deleting a folder is blocked while it contains media or child folders.

## Playback

Native file paths are granted to Tauri's asset-protocol scope when imported/relinked and restored on application startup from the media registry.

The frontend reads native assets through the scoped asset protocol. If no native record exists, legacy/browser media falls back to IndexedDB.

## Portable backup

Portable backups use the extension:

```
.lumarigbackup
```

The file is a ZIP container with:

```text
manifest.json
media/<media-id>/<safe-file-name>
```

The manifest stores:

- the validated transactional ProgramState
- working Show
- reusable Song programs
- saved Shows in the workspace
- Recovery snapshots
- media-folder metadata
- descriptors for every referenced media ID

Lighting recordings that are embedded in Show data are carried by ProgramState. Audio, video, and other file-backed assets are carried under `media/`.

## Export guarantees

1. LumaRig checkpoints current work first.
2. It scans the saved checkpoint for every `mediaId`.
3. IndexedDB-only legacy media is promoted into managed native storage.
4. Every referenced file must exist before export starts.
5. The archive is written only from known registry entries.

A missing referenced file blocks export instead of producing a knowingly broken backup.

## Restore guarantees

1. The archive is opened and its media is extracted into a private staging directory.
2. Backup format, media descriptors, and the ProgramState are validated before the staged files are committed.
3. Existing healthy local assets with the same media ID are preserved.
4. New or currently missing assets are committed into managed storage with their original IDs.
5. The transactional ProgramState is replaced only after validation and media commit.
6. LumaRig reloads from the restored checkpoint.

An invalid manifest does not replace the user's saved program checkpoint or healthy local media.

## Cross-platform behavior

The same registry, archive format, and media IDs are used on macOS and Windows. A backup made on either platform can be restored on the other.

Referenced absolute paths are intentionally machine-local. Portable backup converts the referenced files into archive-contained media, and restored assets become managed copies on the destination computer.

## Failure behavior

- Missing reference: asset stays visible and can be relinked.
- Failed managed copy: the Song is not switched to the incomplete native asset.
- Failed registry write: the previous registry file is restored from its temporary backup.
- Failed backup validation: staged restore data is discarded.
- Failed backup media commit: already committed files from that restore attempt are removed and the existing registry is left unchanged.
- Cloud unavailable: local media and portable backup remain independent of Cloud Shows.
