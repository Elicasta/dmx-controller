import { fixtureColorUpdates, type PatchedFixture } from "../lib/fixtures";
import type { CustomEffect } from "../lib/effects";
import { fixturePhasePositions } from "./fixture-order";
import {
  selectionGridPhases,
  type FixtureSelectionGrid,
} from "./selection-grid";
export function colorRgb(hex: string): [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#ffffff";
  return [1, 3, 5].map((i) => parseInt(safe.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}
export function renderColorPhaser(
  effect: CustomEffect,
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  grid?: FixtureSelectionGrid,
) {
  const targets = fixtures.filter((f) => f.selected);
  const colors = (
    effect.colorPalette?.length ? effect.colorPalette : ["#145dff", "#00dfb5"]
  ).map(colorRgb);
  const phases =
    effect.gridPhaseMode && effect.gridPhaseMode !== "selection"
      ? selectionGridPhases(
          grid,
          targets.map((f) => f.id),
          effect.gridPhaseMode,
        )
      : fixturePhasePositions(targets.length, {
          mode: effect.orderMode ?? "forward",
          blocks: effect.blocks,
          groups: effect.groups,
          wings: effect.wings,
          shift: effect.shift,
        });
  const cycle =
    (60000 / Math.max(20, Math.min(300, effect.bpm))) *
    Math.max(0.125, effect.cycleBeats ?? 4);
  return targets.flatMap((fixture, index) => {
    const travel =
      (Math.max(0, elapsedMs) / cycle) *
      (effect.direction === "reverse" ? -1 : 1);
    const position =
      ((((travel + (phases[index] * effect.phaseSpread) / 100) % 1) + 1) % 1) *
      colors.length;
    const first = colors[Math.floor(position)],
      next = colors[(Math.floor(position) + 1) % colors.length];
    const blend = effect.colorBlend === "step" ? 0 : position % 1;
    const rgb = first.map((c, i) =>
      Math.round(((c + (next[i] - c) * blend) * effect.depth) / 100),
    ) as [number, number, number];
    return fixtureColorUpdates(fixture, rgb);
  });
}
