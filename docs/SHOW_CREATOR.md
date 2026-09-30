# Solo show creator and bar timeline

Open **SHOW → Show Creator**. Name the song, set its tempo, choose the target group, then choose Worship Song, Praise Song or Service Flow. You can also start with one section.

Each section has a color, intensity, fade time, length in bars and primary FX. Add up to eight extra FX layers from the recipe library. Each layer can use a different group and energy level. Use a color wave with a dimmer chase, or add movement on your mover group while your wash group keeps its own rhythm. Later layers win when they control the same attribute.

Preview Section sends the look and FX through the existing playback/output engine. Stop Preview cancels a pending fade and releases the FX layer. The underlying static look remains. Save Section Preset stores the section recipe for reuse in another song.

**Build / Update Sections** creates cues and timeline clips. Rebuilding updates existing section cues without duplicating them and keeps the positions and lengths you already edited on the timeline. Creator drafts, cue recipes, group grids and timeline edits save with the show and survive reopening. Deleting a section draft does not delete an already built cue; remove that cue in Cues when it is no longer needed.

## Row and column FX

In CREATE → Groups, select the group and arrange its selection grid. Fixture identity determines row and column membership, even if the patch or selection order changes.

- Whole rows: every fixture in one row runs in phase; rows chase each other.
- Whole columns: every fixture in one column runs in phase; columns chase each other.
- Across every row: the same phase pattern repeats across each row.
- Down every column: the same phase pattern repeats down each column.

Row recipes require a group target. Movement recipes require a target with movement channels. Missing or deleted targets never fall back to the whole rig.

CREATE → FX also includes the expanded recipe bank, grid phase controls, paired motion and editable color palettes. Color palettes support stepped or smooth transitions and up to sixteen colors.

## Arrange and align

Open **SHOW → Timeline**. Drag a cue from the left library into a lane, or click it to append an eight-bar clip. Drag a clip to move it or move it to another lane. Drag its right edge to resize. Use the inspector for exact bar positions, lengths and lanes. Positions in the UI begin at bar 1.

Use bar, quarter-bar or fine snapping, zoom, Undo/Redo, Duplicate and Delete Clip. Up to eight FX lanes can overlap. Lower lanes override shared attributes while retaining the other attributes from higher lanes. A clip's FX begins at the clip's start and follows the timeline tempo. Seeking to the same song position produces the same effect phase.

Load an audio file or drop it onto the audio lane. Drag the waveform to align the first beat, use its left/right arrow keys, or enter Audio starts at bar. This timeline uses a single tempo and beats-per-bar grid. Audio is played at its original speed; it is not time-stretched. The audio start can be delayed from the beginning of the show.

Play Show runs the lighting and audio together. Pause holds the current lighting frame. Stop / Rewind releases the timeline playback layer and returns the cursor to the start. Navigating away also stops timeline playback. Existing blackout, masters and live overrides still apply through the runtime.

Audio bytes are local and are not embedded into the show JSON. The audio filename and alignment are saved; relink the track after reopening. The new timeline uses local audio transport. Existing MIDI/Studio recording sync remains in its existing workspace.

## Verification

`npm test` covers spatial phase identity, dimmer ceilings, target isolation, stacking, cue identity, show persistence, clip boundaries, deterministic seeks, fades and lane priority. `npm run test:ui` covers song building, preview cancellation, repeated builds, preset saving, clip dragging/resizing, Undo/Redo, audio playback/relink and responsive programmer/FX layouts. CI runs those browser checks separately from frontend and native tests.
