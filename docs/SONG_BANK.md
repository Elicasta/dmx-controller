# Song Bank and show editing

Open **Show → Song Bank**. Add a song, link audio or an MP4, and choose **Build song**. Add the song's sections, preview lighting, then **Build / Update** and open **Timeline** to align the media and lighting.

Each song has a stable identity, its own tempo, sections, cues, timeline and media link. Songs with existing cues or Creator sections appear automatically when opening an older draft. Renaming a song in the bank updates its sections, cues and timeline together. Song names must be unique within a show.

Building a song again updates its generated cues without adding duplicates. Existing clip positions, lengths, lanes and audio offsets remain intact. Deleting a Creator section and rebuilding removes its generated cue and clips. Manually captured cues and the other songs remain intact. Reordering or resizing clips remains a Timeline operation.

Media files are copied into the application's IndexedDB store, separate from show JSON. Selecting a song retrieves that copy; no object URL is written into the saved show. This survives normal app restarts on the same computer. Exported show JSON includes the media filename and link, but does not bundle media bytes. On another computer, link the media again from Song Bank. A storage failure is reported instead of claiming that media was saved.

Selecting a song changes the runtime master tempo to its saved tempo. Manual master changes save to the selected song. MIDI clock remains runtime-only. Switching songs must not overwrite the previous song's saved tempo.

Live uses one full-width workspace column for the controller. Faders, MA and Busk retain their existing controls and assignments, with sizing that fits the available window. Programmer gives Stage, attribute panels and look presets separate grid rows; panels scroll within their area. The dedicated Build → Stage workspace remains large, and Stage can open in its own window.

Validation includes song migration, export/import validation, rename consistency, isolated builds, duplicate prevention, deleted-section cleanup, preserving manual arrangement, per-song media import/switch/reload, master tempo, Live fit and Programmer panel operations. Native macOS media persistence and hardware/DAW behavior still require testing in the packaged app.
