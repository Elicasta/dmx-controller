# Show programming refinement

LIVE retains the September 24 DesktopLiveController surface (Faders, MA and Busk), including the Pro build's fine fader adjustment. Shift-drag gives fine control; double-click resets a fader. Assign includes the row, column and color recipes. Assignment search offers grid and list views.

## Songs and cues
Show → Cues is now a three-level rundown: **Show Section → Song / Media item → Cue**. Sections and items collapse independently, section order is editable, and Cue Inspector assigns a cue to a section and classifies the item as Song or Media. Existing shows remain valid; cues without section metadata appear under Unfiled until assigned. Song Creator creates a Songs section automatically, while imported timeline shows enter the rundown and retain their timeline relationship.

Show → Cues groups cues by their Song / cue group field. Song Creator fills this automatically. Songs collapse independently; search finds matching songs and cues. Song arrows reorder whole groups while preserving tracked lighting states. Individual cues retain their move/delete controls.

Each song's Timeline button opens the arranger alongside the cue library. Import timeline show accepts an exported LumaRig show JSON and adds its cues as one collapsible song, with a separately stored timeline and tempo. Imported fixture IDs and DMX patch addresses must match the current rig. Relink the imported show's audio before playback. The Timeline tab selector switches between the current show and imported timelines. Imported shows persist in show exports and local saves.

Creator can filter sections by song and search by name. Drag FX recipes onto a section or its design panel to stack another layer. In the timeline, switch the library to FX recipes and drag a recipe directly onto a lane. FX-only clips leave unrelated base channels intact and use the displayed target group.

## Audio
Drop audio anywhere in the timeline, or choose Load Audio. File extensions are accepted when the operating system does not provide a MIME type. Native WebView drag interception is disabled to let the HTML drop targets receive files.

The audio playback clock drives cue frames during playback. Normal playback does not repeatedly seek audio to correct animation timing. Explicit seek, stop and resume still reposition audio.

## Workspace
CREATE side panels resize using the vertical dividers (or arrow keys when focused) and collapse from the workspace toolbar. Programmer faders are compact and wrap within their module. Position controls disappear when the selected fixtures have no movement channels. Hue and color wheel are actual interactive inputs; Exact color opens the native color picker.

Stage Monitor is available from every workspace. Its floating panel moves by its header, resizes from its corner and collapses. Pop out opens a separate native stage window on desktop (or a browser window in web preview). It displays the resolved output, including timeline layers and blackout. The detached view does not run a second lighting engine.

MIDI Map opens a scrollable popup without leaving the current workspace. FX recipe assignments are included.
