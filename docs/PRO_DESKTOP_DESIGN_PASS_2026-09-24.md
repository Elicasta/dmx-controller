# LumaRig Professional Desktop Pass — 2026-09-24

This pass tightens the existing LumaRig UI without changing DMX/runtime authority.

## Design decisions

- Keep the current BUILD / CREATE / SHOW / LIVE model. It is a strong professional workflow and should remain stable.
- Reduce application chrome so the main work area wins more vertical space.
- Treat panels as desktop split views instead of stacks of rounded cards.
- Use blue-gray selection for navigation and selected objects. Reserve green for live/connected/output states.
- Keep side rails dense and source-list-like.
- Make CREATE the most information-dense workspace while preserving a usable stage preview.
- Keep SHOW cue construction dense enough to read like production software instead of a dashboard.
- Keep LIVE execution dominant. Secondary live tools use a compact contextual strip.
- Fit faders into their available region before introducing scroll. Scrolling begins after minimum useful dimensions are reached.
- Preserve keyboard and touch support. Shift is the fine-adjust modifier. Double-click resets a live fader.
- Keep controls square/compact with restrained radius and minimal gradients.

## Visual system

Primary surfaces:
1. Canvas
2. Chrome/panel
3. Raised interactive control

Spacing follows a compact 4px base rhythm.

Selection uses `--pro-select`.
Operational success/live output uses `--pro-live`.
Warnings and blackout remain distinct.

## Implementation

The final override layer lives in:

`src/pro-desktop-pass.css`

It intentionally loads after the existing workspace polish so this pass is isolated, easy to tune, and does not require rewriting the older CSS in one risky change.

## Interaction changes

Desktop live faders now support:

- direct pointer/touch drag
- Shift + pointer drag for fine adjustment
- Arrow keys for 1% adjustment
- Shift + Arrow keys for 0.1% adjustment
- Page Up / Page Down for 10% adjustment
- Shift + Page Up / Page Down for 1% adjustment
- Home / End for 0% / 100%
- double-click reset to 0%

A regression test covers fine keyboard adjustment and double-click reset.

## Follow-up passes

The next contained passes should be:

1. Native macOS menu commands and shortcuts
2. True draggable sidebar/inspector splitters with persisted widths
3. Build patch table conversion
4. Show timeline/cue inspector refinement
5. Live hardware assignment and context-menu polish
6. Full state/accessibility audit
