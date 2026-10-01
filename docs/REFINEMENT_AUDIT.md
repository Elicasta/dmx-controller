# LumaRig refinement audit

Reviewed against the 32-item refinement request and the 0.2.2 implementation. The 0.2.3 repair pass addresses preservation, reusable songs, tempo editing, panel resizing and the repeated layout failures. This is not a claim that all integrations, media outputs or rendering requests are finished.

## 0.2.4 internal workflow milestone
External Ableton/LumaLive/MIDI linking is explicitly deferred until internal editing is complete.

Now implemented and regression checked:
- Content-keyed persistent waveform analysis with every sample from every channel contributing.
- Non-destructive Timeline media trim in/out and correct source-time playback.
- Lane/waveform seeking, draggable playhead, beat/bar keyboard steps and cue jump picker.
- Independent section group layers with color, intensity, musical cycle/rate, phase, phase spread, direction, offset and explicit order.
- Custom Programmer FX in the recipe browser, favorites, section notes and clipboard copy/paste.
- Creator Save to Song Library rebuilds current programming before saving reusable masters.
- True orthographic Top/Front/Side views through the existing Visualizer, with projection-preserving zoom.
- A native video output window that follows the main media element, preserves aspect ratio and supports fullscreen.

Still open after this milestone:
- Shared source-neutral Transport Engine and Connection Manager.
- Managed native media directories, copy/reference choice, missing-media detection and relink workflow.
- Stage screen MP4/image/test source assignment.
- Tempo analysis with confidence/downbeat and manual correction tools.
- Beat-based Step Editor.
- Recording pause/rewind/overdub and Timeline editing.
- Volumetric beam/occlusion/surface spill and replacement crowd geometry.
- Further Cues/Live polish, cross-rig fixture mapping and explicit Song master version handling.
- Physical Mac, multi-monitor and show-hardware validation.

The detailed rows below describe the earlier 0.2.3 baseline; this update supersedes their Timeline, section-layer, FX-browser, orthographic-view and video-output gaps.

## Current changes

- Song Bank has two distinct lists: this Show's songs and the reusable Song Library. A Song Program includes media links, decimal tempo and lock, sections, cues, fixture-group definitions, position palettes and timeline arrangement. Add to Show copies the program with fresh editable identities.
- Atomic checkpoints preserve the working Show, patch, stage, looks, custom FX, section presets, saved Shows, MIDI mappings, settings and tempo authority. New Show, Load and Recovery await a successful checkpoint. Failure keeps the current work open. Recovery retains ten outgoing Shows and their rig snapshots.
- Startup prefers the validated checkpoint over compatibility localStorage. Existing drafts and saved Shows seed the library. Older saved Shows cannot silently replace newer library masters. Corrupt data is preserved and reported.
- Tempo fields preserve incomplete typing, accept decimals, use predictable arrow increments and ignore the mouse wheel. Typing locks manual BPM. Studio synchronization and MIDI transport cannot override that lock.
- One splitter component serves Programmer, Creator, Cues, Timeline and FX Parameters. Widths and collapsed states persist. Pointer and keyboard resizing obey bounds. Double-click or Home resets a divider. Panels stack or collapse when their minimum widths cannot fit.
- Live's Controller, Fixtures, Groups, Masters, Shortcuts and System use one bounded column. Fixtures uses explicit banks of up to eight faders, sized from its actual container. Programmer keeps a usable Stage canvas and scrolls its central content vertically when necessary.
- Shared semantic tokens replace low-contrast neutral text across existing styles. Inputs, placeholders, disabled controls and keyboard focus have defined theme states. Crowd starts off; MA's command strip uses tighter, fixed touch-target spacing.

## Match against the request

| # | Request | Current evidence and remaining work |
|---|---|---|
| 1 | Global responsive UI | Shared splitters, bounded Live surfaces, compact tabs and wrapping controls in 0.2.3. Continue auditing Build, connection panels and uncommon modal combinations; do not certify every possible viewport from a few screenshots. |
| 2 | Text / contrast | Semantic tokens and form/focus/disabled rules added. Low-contrast neutral declarations migrated. Audit colored labels on custom fixture colors and native output windows separately. |
| 3 | Panel resizing | Programmer, Creator, Cues, Timeline and FX Parameters covered. FX browser's outer sidebar and Build inspectors need the same treatment. |
| 4 | LumaLive / Ableton architecture | Existing Studio bridge and MIDI handlers remain separate. Build one source-neutral transport store and Connection Manager, then implement actual Ableton Link, clock and transport adapters. No Link support is claimed. |
| 5 | Media system | Local song media copies and MP4 file selection already exist. MP4 selection is not synchronized screen playback. Add an asset registry, native path resolution, screen source types and a shared audio/video timebase. |
| 6 | Video popout | Stage popout exists. Add a dedicated media output window with aspect ratio, fullscreen and shared transport. |
| 7 | Programmer Visualizer | Programmer already uses Visualizer3D; 0.2.3 protects its canvas. Add explicit Perspective / Top / Front / Side presets and verify fixture/screen output in each. |
| 8 | Reusable Song Library | Independent library and safe reuse implemented. Add library import/export and explicit version/conflict management for editing the same Song in multiple Shows. |
| 9 | Managed folder | IndexedDB media storage survives local restarts. Native Audio/Video/Shows/Songs/Presets/Recordings folders, copy/reference policy and path relinking remain. |
| 10 | Tempo control | Draft-safe numeric editing, decimal BPM, arrows, wheel protection, tap tempo and explicit manual lock implemented. Ensure future detection uses an explicit re-analysis action. |
| 11 | Tempo detection | No real detector with confidence/downbeat was found in the reviewed Creator path. Add analysis, confidence, half/double candidates, downbeat editing and opt-in application. |
| 12 | FX browser | Creator has search/categories and a bounded recipe list. Unify factory recipes, custom FX, favorites and presets behind one browser. |
| 13 | Multi-group layers | Sections already have independently targeted recipe layers with energy and enabled state; builds create effect stacks. Add per-layer intensity/color/rate/phase/direction/offset/priority controls and their persistence. |
| 14 | Musical FX speed | Phaser engine has BPM-derived cycleBeats and lane rateMultiplier. Expose the requested subdivisions/multipliers consistently in Sections and Live, including triplets and 1/16 beat. |
| 15 | Sections | Rename, duplicate, delete, reorder and section presets already exist. Presets now checkpoint with the app. Add copy/paste, notes/color metadata and clearer Save to Song actions. |
| 16 | Cues | Existing rundown hierarchy retained; panels resize/collapse and long cue labels truncate. Finish compact contextual menus and secondary-action consolidation. |
| 17 | Timeline transport | Existing sticky toolbar retained. Test long vertical arrangements and docked Cues timelines; route controls to the shared transport. |
| 18 | Seeking | Ruler click seek exists. Audio block dragging edits alignment. Add seek from every lane/waveform, draggable playhead, beat/bar keyboard steps and jumps. |
| 19 | Real waveform | Current editor decodes channel 0 into 320 peaks on mount. It is real amplitude data but too coarse for detailed programming. Precompute/cache multiresolution, multichannel peaks on import and overlay beat subdivisions. |
| 20 | Trimming | Clip resizing changes cue duration; audioOffsetBars changes media alignment. Neither trims media. Add non-destructive trim-in/out to the media model and shared playback. |
| 21 | Step Editor | FX step recipes exist. Add a beat/subdivision editor attached to Section or Timeline clips with target, color, position and hit events. |
| 22 | Tracks | Existing external-track arming and offset follow MIDI. Route Internal Media, LumaLive, Ableton and External MIDI through the shared source-neutral transport. |
| 23 | Autosave / Recovery | Working application state, reusable songs, saved Shows and bounded Recovery implemented with atomic writes and failure guards. Add portable backup/export including media bytes and packaged-app interruption testing. |
| 24 | MIDI Sync | Existing clock, MIDI mappings, transport and lighting offset retained; manual BPM lock now enforced. Consolidate status/source/latency with Connection Manager. |
| 25 | Recording | Existing record/stop/save/playback remains. Add pause/rewind/overdub and editable Timeline events using shared transport. |
| 26 | Crowd | Default off implemented. Optimized instanced human geometry and animation remain. |
| 27 | Beams | Existing canvas rendering retained. Volumetric geometry, angle stability, haze, overlap and near-camera behavior require a rendering pass and angle-specific evidence. |
| 28 | Surface lighting | Existing geometry/intersection helpers do not establish full projected light interaction. Implement and verify wall/floor/object footprints and occlusion. |
| 29 | MA spacing | Left command strip tightened to 48px touch targets. Verify in the packaged app at display scale factors used on stage. |
| 30 | Busk spacing | Existing responsive bank rules retained. Continue testing long labels and large fixture/FX libraries in each density mode. |
| 31 | Live horizontal overflow | Container fixed for every Live page. Fixture banks calculate capacity and paginate; Groups/System use bounded grids. Browser coverage includes narrow windows and 24 fixtures. |
| 32 | App refinement | Shared spacing, panel behavior and theme-state repairs in this pass. Continue menu/icon/input consistency and native-window behavior after workflow/integration features are complete. |

## Next implementation sequence

1. Finish the P0 browser and native build checks; package the verified repair pass.
2. Finish the musical editing workflow: cached waveforms, all-lane seeking, trims, full Section layer controls and unified FX browser.
3. Introduce the Transport Engine and Connection Manager before connecting Ableton, LumaLive, Tracks, Recording and MP4 output. Keep one media clock and one authority policy.
4. Add managed native media folders and output windows; improve beam volumes and surface lighting; replace crowd geometry.
5. Complete recording/overdub and the beat Step Editor, then repeat Live and native-window usability checks.

## Validation limits

193 unit tests and the production frontend build pass locally. Browser and native checks run in CI. Hardware DMX, Ableton, MIDI devices, interrupted native storage and fullscreen output on a second monitor need actual packaged-app validation. Do not equate MP4 file selection, a connection badge, FX step recipes or a Stage popout with their fuller requested workflows.
