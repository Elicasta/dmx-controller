# Song Bank and show editing

Open **Show → Song Bank**. Add a song, link audio or an MP4, and choose **Build song**. Add the song's sections, preview lighting, then **Build / Update** and open **Timeline** to align the media and lighting.

Each song has a stable identity, its own tempo, sections, cues, timeline and media link. Songs with existing cues or Creator sections appear automatically when opening an older draft. Renaming a song in the bank updates its sections, cues and timeline together. Song names must be unique within a show.

Building a song again updates its generated cues without adding duplicates. Existing clip positions, lengths, lanes and audio offsets remain intact. Deleting a Creator section and rebuilding removes its generated cue and clips. Manually captured cues and the other songs remain intact. Reordering or resizing clips remains a Timeline operation.

Media files are copied into the application's IndexedDB store, separate from show JSON. Selecting a song retrieves that copy; no object URL is written into the saved show. This survives normal app restarts on the same computer. Exported show JSON includes the media filename and link, but does not bundle media bytes. On another computer, link the media again from Song Bank. A storage failure is reported instead of claiming that media was saved.

Selecting a song changes the runtime master tempo to its saved tempo. Manual master changes save to the selected song. MIDI clock remains runtime-only. Switching songs must not overwrite the previous song's saved tempo.

Live uses one full-width workspace column for the controller. Faders, MA and Busk retain their existing controls and assignments, with sizing that fits the available window. Programmer gives Stage, attribute panels and look presets separate grid rows; panels scroll within their area. The dedicated Build → Stage workspace remains large, and Stage can open in its own window.

Validation includes song migration, export/import validation, rename consistency, isolated builds, duplicate prevention, deleted-section cleanup, preserving manual arrangement, per-song media import/switch/reload, master tempo, Live fit and Programmer panel operations. Native macOS media persistence and hardware/DAW behavior still require testing in the packaged app.

## Independent Song Library and Recovery (0.2.3)

Song Bank now separates **songs in this Show** from the independent **Song Library**. Songs and changes to their sections, cues, tempo and timeline are checkpointed automatically. **Save Song** explicitly updates that song's library master. **Add to Show** copies the saved program, remapping section/cue/clip/group identities and retaining its media link and arrangement. Each Show keeps its own editable copy; saved Shows do not change when another Show is edited. The library holds the latest saved programming for a song, not a full version history.

**New Show**, **Load**, and **Restore Show** first commit the outgoing programming and a Recovery entry. If saving fails, the transition is cancelled and the current Show stays open. **Show Library → Recovery** exposes the ten most recent outgoing Shows. Recovery restores Show programming together with its captured patch, stage, looks and FX. The current saved Show list and connection settings are retained.

The authoritative working Show, patch, stage, looks, custom FX, section presets, saved Show list, MIDI mappings, settings, tempo authority, reusable programs and Recovery entries are committed together in one IndexedDB transaction with strict durability requested. A failed or aborted transaction leaves the previous committed record intact. On startup, this checkpoint takes precedence over the compatibility localStorage copy. Existing working drafts and saved Shows seed the library without replacing an existing library master. Corrupt checkpoints are left intact and reported instead of overwritten.

BPM fields retain incomplete typing, accept decimals, increment by one with arrow keys (0.1 with Shift), and cannot change from scrolling the mouse wheel. Invalid or empty values revert on blur. Manual song tempo updates its sections and timeline; song switching retains saved tempo. Typing a tempo locks it. Creator and Timeline expose Tempo Locked / Lock Tempo. Song copies retain the lock; MIDI transport and Studio sync cannot replace a locked manual BPM. Explicit MIDI-mapped tempo changes and remote tempo controls count as user edits. The shared transport architecture remains a separate integration task.

Media remains local to this application installation. This pass does not create the managed native filesystem folder, bundle media in show exports, remap a song to a different fixture rig, or add synchronized video output. Back up exported Shows and source media separately. Crowd now starts OFF. The Creator recipe list has a bounded scrolling area; unifying factory/custom recipe libraries remains open.

Programmer, Creator, Cues, Timeline and FX Parameters share column splitters that persist widths and collapsed panels, constrain keyboard/pointer resizing, and support double-click/Home reset. Narrow containers collapse secondary panels to protect the central editor. The Stage canvas has its own minimum visible height; the center scrolls vertically when the Stage and attribute deck cannot both fit. Creator, Timeline and FX editors stack their panels when side-by-side minimum widths cannot fit. Live Fixtures uses explicit banks sized for the available width; Groups, Masters and System fit the same bounded workspace. Theme text uses shared semantic tokens, including disabled and focus states.
