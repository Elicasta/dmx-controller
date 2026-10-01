# Internal workflow pass
External Ableton, LumaLive, MIDI connection adapters and shared connection UI are deferred until the internal editing workflow is complete.

## Timeline media
- Non-destructive trim in/out stored on the Song timeline; legacy songs remain untrimmed.
- Media clock starts at source trim-in and stops at trim-out. Lighting clips can continue after the media ends.
- Cached SHA-256 keyed waveform analysis covers every sample in every channel at up to 100 peaks/second. Import warms the cache; reopening uses saved peaks. Cache write failures do not block media import or playback.
- Waveform rendering aggregates peak maxima to the available display resolution. Original audio/video bytes are unchanged.
- Click the ruler, waveform or an empty FX lane to seek. Alt-drag the waveform to move its timeline offset. Drag its ends to trim.
- Drag playhead, step beats with arrows, bars with Shift+arrows, Home to rewind, Space to play/pause from the timeline editing area.
- Transport remains sticky; cue jump picker uses clip start positions.
- Trim edge keyboard editing uses 10ms steps. Numeric inspector fields use seconds.
- MP4 with embedded audio is accepted by Timeline; this does not yet provide video screen output.
- Relinked shorter sources clamp playback to the new duration; Reset Trim restores the full source.

## Validation
Unit tests cover source time mapping, offset, trim end, legacy validation, shorter relinks, invalid checkpoints, beat stepping and stereo/final-sample transients.
Browser checks cover cached waveform, trim playback, lane seeking, keyboard stepping, cue jumping, persisted trim and reset.

## Still to complete
Section editing, per-group FX controls, musical rate browsers, managed native media/relink workflow, video output, orthographic Visualizer views, beam/surface rendering, Step Editor and Recording editing/overdub remain in the ordered refinement backlog. External linking comes last.
