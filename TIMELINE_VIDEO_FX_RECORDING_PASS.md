# LumaRig 0.2.6: Timeline, video, FX and recording refinement

Timeline now owns its complete lighting frame. Empty spans, deleted/muted clips and the final boundary produce blackout. Overlays still combine by lane priority and resume lower clips only while those clips remain active. Explicit Stop also clears lighting; navigation holds the selected frame.

A shared FX catalog includes recipes, Programmer factory conversions and every saved custom effect. Both Timeline and Show Creator expose My FX. Primary and stacked Section FX save their own snapshots so later edits or deletion of a bank item cannot break existing programming.

Independent video clips can also be imported onto their own Timeline lane, dragged, trimmed, muted, duplicated and deleted. Gaps in this lane send a black feed to screens and the clean output window. Clips follow the Song timebase silently; primary Song media owns embedded audio.

Stage screens accept Timeline video in addition to NDI. Importing an MP4 on a screen imports it as Song/Timeline media and assigns that display; the Timeline toolbar can choose the display directly. Silent screen followers seek/play/pause against the existing authoritative media element, including embedded audio in the original track. The native output window retains the same source. Media heartbeat continues during background throttling and stage followers stop if updates disappear.

Venue presets replace the scene repeatedly without depending on native JavaScript confirmation. Preset buttons fit their descriptions. Shared Labels On/Off applies to embedded 3D views and the plot. Render High adds supersampling up to 3x and a 60fps target; this remains the existing Canvas renderer, not a new GPU renderer.

Mac export writes a new H.264/AAC 1080p MP4 for the selected trimmed clip or primary video into Movies/LumaRig Exports and reveals it in Finder. It uses the macOS converter, streams source bytes in bounded chunks, validates trims and export jobs, and preserves originals.

Recorded takes import as independent Song versions linked to the original Song. Captured lighting becomes an editable Timeline take clip, with positioning, trimming, frame-channel editing and FX overlays. Original Songs and takes remain unchanged.

The tempo header has a beat pulse. Recording has Song Library and saved-take selection, Play/Pause/Stop, Rewind, beat/bar stepping, seek, bar/beat/time, BPM and source display. Recording pause freezes capture time and resume continues the same take. Record stays in the Recording page with an Open Live controls shortcut.

Ctrl/Cmd C/V copies Timeline clips, Sections, Cues, stage objects and Programmer FX in their editing contexts. Ctrl/Cmd Z, Shift Z and Y support undo/redo. Native input/text editing retains its shortcuts. Application edit history covers Show, patch, stage, looks and FX edits; live output and fixture selection are not history entries.

## Verification

Unit coverage checks full Timeline blackout boundaries, overlay return, full FX availability, and durable primary FX snapshots. Browser checks cover saved FX in all editors, clip shortcuts, repeated preset replacement, labels/High render, recording pause/resume/save and video display routing/seek/reload. Universal Mac CI runs native tests, including a real generated MP4 trimmed through the exporter and checked for output duration and H.264 encoding; it builds both architectures and verifies the app signature and DMG checksum.

Physical Mac operation, actual MP4 codec playback, multi-monitor output and show hardware still require physical validation. External Ableton/LumaLive/MIDI linking remains deferred. Managed media/relinking, source-neutral transport, overdub, advanced tempo analysis and the volumetric Visualizer work remain on the larger refinement backlog.
