import { applyUniverseUpdates, makeUniverse, type DmxUpdate } from "./dmx";
import {
  fixtureColorUpdates,
  fixtureParameterUpdate,
  parameterChannel,
  type PatchedFixture,
} from "./fixtures";
import { renderCustomEffect, type CustomEffect } from "./effects";
import type { FixtureGroup, ShowCue } from "./show";
import { colorRgb } from "../core/color-phaser";
import {
  normalizeSelectionGrid,
  type FixtureSelectionGrid,
} from "../core/selection-grid";

export type EffectStackLayer = {
  id: string;
  name: string;
  targetIds: string[];
  effect: CustomEffect;
  selectionGrid?: FixtureSelectionGrid;
  enabled?: boolean;
  phaseOffsetBeats?: number;
};
export type SectionLayer = {
  stepEditor?: boolean;
  customEffect?: CustomEffect;
  intensity?: number;
  color?: string;
  cycleBeats?: number;
  rateMultiplier?: number;
  phaseOffsetBeats?: number;
  phaseSpread?: number;
  direction?: 'forward' | 'reverse';
  offset?: number;
  motionShape?: CustomEffect['motionShape'];
  id: string;
  recipeId: string;
  groupId: string;
  energy: number;
  enabled: boolean;
};
export type ShowSection = {
  primaryEffect?: CustomEffect;
  notes?: string;
  id: string;
  song: string;
  name: string;
  groupId: string;
  color: string;
  intensity: number;
  bpm: number;
  bars: number;
  fadeMs: number;
  recipeId: string;
  energy: number;
  layers: SectionLayer[];
};
export type TimelineClip = {
  id: string;
  cueId: string;
  startBar: number;
  lengthBars: number;
  lane: number;
  enabled: boolean;
};
export type TimelineMediaClip = {
  id:string; mediaId:string; name:string; startBar:number; lengthBars:number;
  durationMs:number; trimInMs:number; trimOutMs:number; enabled:boolean;
};
export type TimelineTakeClip = {
  id:string; name:string; recordingId:string; startBar:number; lengthBars:number;
  durationMs:number; trimInMs:number; trimOutMs:number; enabled:boolean;
  frames:Array<{timeMs:number;updates:DmxUpdate[]}>;
};
export type ShowTimeline = {
  videoClips?: TimelineMediaClip[];
  takeClips?: TimelineTakeClip[];
  bpm: number;
  beatsPerBar: number;
  audioOffsetBars: number;
  audioName?: string;
  audioTrimInMs?: number;
  audioTrimOutMs?: number;
  clips: TimelineClip[];
};
export const EMPTY_TIMELINE: ShowTimeline = {
  bpm: 100,
  beatsPerBar: 4,
  audioOffsetBars: 0,
  clips: [],
};
export const SHOW_COLORS = [
  { name: "Warm White", hex: "#ffd8a0" },
  { name: "Sunset", hex: "#ff6b24" },
  { name: "Ocean Blue", hex: "#145dff" },
  { name: "Seafoam", hex: "#00dfb5" },
  { name: "Crimson", hex: "#dc214c" },
  { name: "Lavender", hex: "#aa78ff" },
  { name: "Hot Pink", hex: "#ff24a3" },
  { name: "Clean White", hex: "#ffffff" },
];
export type FxRecipe = {
  id: string;
  name: string;
  category: "Intensity" | "Rows" | "Movement" | "Color" | "Custom";
  description: string;
  effect: CustomEffect;
};
const base: CustomEffect = {
  id: "recipe",
  name: "Recipe",
  parameter: "dimmer",
  waveform: "sine",
  bpm: 100,
  depth: 70,
  offset: 20,
  phaseSpread: 100,
  cycleBeats: 4,
  mode: "absolute",
};
function recipe(
  id: string,
  name: string,
  category: FxRecipe["category"],
  description: string,
  effect: Partial<CustomEffect>,
): FxRecipe {
  return {
    id,
    name,
    category,
    description,
    effect: { ...base, ...effect, id, name },
  };
}
export const FX_RECIPES: FxRecipe[] = [
  recipe("breathe", "Slow Breathe", "Intensity", "A soft four-bar swell", {
    phaseSpread: 0,
    cycleBeats: 16,
    depth: 35,
    offset: 45,
  }),
  recipe(
    "wave",
    "Traveling Wave",
    "Intensity",
    "Smooth light rolling through your selection",
    {},
  ),
  recipe("chase", "Step Chase", "Intensity", "One bright step at a time", {
    waveform: "step",
    offset: 0,
    depth: 100,
  }),
  recipe("row-chase", "Row Chase", "Rows", "Each whole row moves together", {
    waveform: "step",
    offset: 0,
    depth: 100,
    gridPhaseMode: "rows",
  }),
  recipe(
    "column-chase",
    "Column Chase",
    "Rows",
    "Each whole column moves together",
    { waveform: "step", offset: 0, depth: 100, gridPhaseMode: "columns" },
  ),
  recipe(
    "parallel-rows",
    "Parallel Row Wave",
    "Rows",
    "The same wave travels across every row",
    { gridPhaseMode: "across-rows" },
  ),
  recipe(
    "parallel-columns",
    "Down Column Wave",
    "Rows",
    "The same wave travels down every column",
    { gridPhaseMode: "across-columns" },
  ),
  recipe(
    "mirror",
    "Mirrored Pulse",
    "Intensity",
    "Builds outward from the center",
    { orderMode: "center-out" },
  ),
  recipe(
    "pairs",
    "Alternating Pairs",
    "Intensity",
    "Odd and even fixtures answer each other",
    { waveform: "square", groups: 2, depth: 80, offset: 10 },
  ),
  recipe(
    "circle",
    "Gentle Circle",
    "Movement",
    "A small smooth circle around your position",
    {
      parameter: "position",
      motionShape: "circle",
      depth: 30,
      offset: 0,
      mode: "relative",
      cycleBeats: 8,
    },
  ),
  recipe("eight", "Figure Eight", "Movement", "Fluid paired pan and tilt", {
    parameter: "position",
    motionShape: "figure-eight",
    depth: 40,
    offset: 0,
    mode: "relative",
    cycleBeats: 8,
  }),
  recipe("tilt", "Tilt Wave", "Movement", "A wave of tilts along the rig", {
    parameter: "tilt",
    depth: 25,
    offset: 0,
    mode: "relative",
    cycleBeats: 8,
  }),
  recipe(
    "circle-pulse",
    "Circle + Pulse",
    "Movement",
    "Moving circles with a separate intensity rhythm",
    {
      parameter: "position",
      motionShape: "circle",
      depth: 30,
      offset: 0,
      mode: "relative",
      cycleBeats: 8,
      lanes: [
        {
          parameter: "dimmer",
          waveform: "sine",
          depth: 50,
          offset: 35,
          rateMultiplier: 2,
        },
      ],
    },
  ),
  recipe(
    "ocean",
    "Ocean Color Wave",
    "Color",
    "Blue and teal flow through the rig",
    {
      parameter: "color",
      depth: 100,
      colorPalette: ["#145dff", "#00dfb5"],
      colorBlend: "smooth",
      cycleBeats: 8,
    },
  ),
  recipe("sunset", "Sunset Chase", "Color", "Amber, crimson and pink steps", {
    parameter: "color",
    depth: 100,
    colorPalette: ["#ff6b24", "#dc214c", "#ff24a3"],
    colorBlend: "step",
  }),
  recipe(
    "row-color",
    "Row Color Chase",
    "Rows",
    "Whole rows change color together",
    {
      parameter: "color",
      depth: 100,
      colorPalette: ["#145dff", "#aa78ff", "#00dfb5"],
      colorBlend: "step",
      gridPhaseMode: "rows",
    },
  ),
  recipe(
    "column-color",
    "Column Color Chase",
    "Rows",
    "Whole columns change color together",
    {
      parameter: "color",
      depth: 100,
      colorPalette: ["#ff6b24", "#dc214c", "#ff24a3"],
      colorBlend: "step",
      gridPhaseMode: "columns",
    },
  ),
  recipe("rainbow", "Rainbow Blend", "Color", "A slow full-spectrum wash", {
    parameter: "color",
    depth: 100,
    colorPalette: ["#ff2424", "#ffad24", "#2bff65", "#24cfff", "#aa24ff"],
    colorBlend: "smooth",
    cycleBeats: 8,
  }),
];
export const SONG_TEMPLATES = [
  {
    name: "Worship Song",
    description: "Space, lift, a big chorus, then a quiet landing",
    sections: [
      "Intro",
      "Verse 1",
      "Chorus 1",
      "Verse 2",
      "Chorus 2",
      "Bridge",
      "Final Chorus",
      "Outro",
    ],
  },
  {
    name: "Praise Song",
    description: "An energetic opening and driving chorus",
    sections: ["Intro", "Verse", "Chorus", "Breakdown", "Final Chorus"],
  },
  {
    name: "Service Flow",
    description: "Walk-in, welcome, speaking and music",
    sections: ["Walk In", "Welcome", "Worship", "Message", "Walk Out"],
  },
];
export function createSection(
  name = "New Section",
  song = "New Song",
  groupId = "",
  bpm = 100,
): ShowSection {
  const lift = /chorus|bridge|worship/i.test(name);
  return {
    id: crypto.randomUUID(),
    song,
    name,
    groupId,
    color: lift ? "#145dff" : "#ffd8a0",
    intensity: lift ? 85 : 55,
    bpm,
    bars: 8,
    fadeMs: lift ? 1200 : 2500,
    recipeId: lift ? "wave" : "breathe",
    energy: lift ? 80 : 40,
    layers: [],
  };
}
export function sectionTargets(
  section: ShowSection,
  fixtures: readonly PatchedFixture[],
  groups: readonly FixtureGroup[],
) {
  const ids = new Set<string>();
  const groupIds = [
    section.groupId,
    ...section.layers.filter((l) => l.enabled).map((l) => l.groupId),
  ];
  for (const groupId of groupIds) {
    if (!groupId) fixtures.forEach((f) => ids.add(f.id));
    else
      (groups.find((g) => g.id === groupId)?.fixtureOrder ?? []).forEach((id) =>
        ids.add(id),
      );
  }
  return fixtures.filter((f) => ids.has(f.id));
}
export function sectionStack(
  section: ShowSection,
  fixtures: readonly PatchedFixture[],
  groups: readonly FixtureGroup[],
): EffectStackLayer[] {
  const specs: SectionLayer[] = [
    {
      id: section.id,
      recipeId: section.recipeId,
      customEffect: section.primaryEffect,
      groupId: section.groupId,
      energy: section.energy,
      enabled: true,
    },
    ...section.layers,
  ];
  return specs
    .filter((l) => l.enabled && l.recipeId)
    .map((layer) => {
      const found = layer.customEffect ? {
        name: layer.customEffect.name,
        category: layer.customEffect.parameter === 'position' || layer.customEffect.parameter === 'pan' || layer.customEffect.parameter === 'tilt' ? 'Movement' : 'Custom',
        effect: layer.customEffect,
      } : FX_RECIPES.find((r) => r.id === layer.recipeId);
      if (!found) throw Error("Choose an FX recipe from the library.");
      const group = groups.find((g) => g.id === layer.groupId);
      if (layer.groupId && !group)
        throw Error("The selected group is missing. Choose another group.");
      const ids = group ? group.fixtureOrder : fixtures.map((f) => f.id);
      const targets = ids
        .map((id) => fixtures.find((f) => f.id === id))
        .filter((f): f is PatchedFixture => Boolean(f));
      if (!targets.length)
        throw Error("Patch fixtures into the selected target first.");
      if (found.effect.gridPhaseMode && !group)
        throw Error(
          "Row FX need a group. Arrange its selection grid in BUILD → Groups.",
        );
      if (
        found.category === "Movement" &&
        !targets.some(
          (f) =>
            parameterChannel(f, "pan") !== null ||
            parameterChannel(f, "tilt") !== null,
        )
      )
        throw Error("Movement FX need a target with moving fixtures.");
      const effect = structuredClone(found.effect);
      effect.bpm = section.bpm;
      effect.cycleBeats = Math.max(0.0625, Math.min(32, (layer.cycleBeats ?? effect.cycleBeats ?? 1) / (layer.rateMultiplier ?? 1)));
      effect.phaseSpread = layer.phaseSpread ?? effect.phaseSpread;
      effect.direction = layer.direction ?? effect.direction;
      effect.offset = layer.offset ?? effect.offset;
      effect.motionShape = layer.motionShape ?? effect.motionShape;
      if (layer.motionShape) effect.parameter = "position";
      const intensity = layer.intensity ?? section.intensity;
      effect.depth *= layer.energy / 100;
      if (effect.parameter === "dimmer") {
        effect.depth *= intensity / 100;
        effect.offset *= intensity / 100;
      }
      effect.lanes = effect.lanes?.map((l) =>
        l.parameter === "dimmer"
          ? {
              ...l,
              depth: (l.depth * intensity) / 100,
              offset: (l.offset * intensity) / 100,
            }
          : l,
      );
      return {
        id: layer.id,
        name: found.name,
        targetIds: targets.map((f) => f.id),
        effect,
        phaseOffsetBeats: layer.phaseOffsetBeats,
        selectionGrid: group
          ? normalizeSelectionGrid(group.selectionGrid, group.fixtureOrder)
          : undefined,
      };
    });
}
export function renderEffectStack(
  layers: readonly EffectStackLayer[],
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  base: readonly number[],
  bpm?: number,
): DmxUpdate[] {
  const updates = new Map<number, number>();
  for (const layer of layers) {
    if (layer.enabled === false) continue;
    const targets = layer.targetIds
      .map((id) => fixtures.find((f) => f.id === id))
      .filter((f): f is PatchedFixture => Boolean(f))
      .map((f) => ({ ...f, selected: true }));
    const effect = bpm ? { ...layer.effect, bpm } : layer.effect;
    renderCustomEffect(
      effect,
      targets,
      elapsedMs + (((layer.phaseOffsetBeats ?? 0) % (effect.cycleBeats ?? 1) + (effect.cycleBeats ?? 1)) % (effect.cycleBeats ?? 1)) * 60000 / effect.bpm,
      base,
      layer.selectionGrid,
    ).forEach(([c, v]) => updates.set(c, v));
  }
  return [...updates.entries()];
}
export function buildSectionCues(
  sections: readonly ShowSection[],
  fixtures: readonly PatchedFixture[],
  groups: readonly FixtureGroup[],
  existing: readonly ShowCue[] = [],
): ShowCue[] {
  return sections.map((section, index) => {
    const rgb = colorRgb(section.color);
    const changes: DmxUpdate[] = sectionTargets(
      section,
      fixtures,
      groups,
    ).flatMap((f) => {
      const dimmer = fixtureParameterUpdate(
        f,
        "dimmer",
        section.intensity * 2.55,
      );
      const uv = fixtureParameterUpdate(f, "uv", 0);
      return [
        ...fixtureColorUpdates(f, rgb),
        ...(dimmer ? [dimmer] : []),
        ...(uv ? [uv] : []),
      ];
    });
    // Layer array order is explicit priority; only its own group's static attributes are overridden.
    for (const layer of section.layers) {
      if (!layer.enabled || (layer.color === undefined && layer.intensity === undefined)) continue;
      const group = groups.find(g => g.id === layer.groupId);
      const ids = new Set(group?.fixtureOrder ?? (layer.groupId ? [] : fixtures.map(f => f.id)));
      for (const fixture of fixtures.filter(f => ids.has(f.id))) {
        if (layer.color) changes.push(...fixtureColorUpdates(fixture, colorRgb(layer.color)));
        if (layer.intensity !== undefined) {
          const dimmer = fixtureParameterUpdate(fixture, 'dimmer', layer.intensity * 2.55);
          if (dimmer) changes.push(dimmer);
        }
      }
    }
    if (!changes.length)
      throw Error("Patch fixtures into the selected target first.");
    const stack = sectionStack(section, fixtures, groups);
    return {
      id:
        existing.find((c) => c.sourceSectionId === section.id)?.id ??
        crypto.randomUUID(),
      sourceSectionId: section.id,
      number: index + 1,
      name: `${section.song} · ${section.name}`,
      trackName: section.song,
      color: section.color,
      fadeMs: section.fadeMs,
      values: {
        red: rgb[0],
        green: rgb[1],
        blue: rgb[2],
        uv: 0,
        dimmer: section.intensity * 2.55,
      },
      changes,
      universe: applyUniverseUpdates(makeUniverse(), changes),
      effectStack: stack,
    };
  });
}
export function barMs(timeline: Pick<ShowTimeline, "bpm" | "beatsPerBar">) {
  return (60000 / timeline.bpm) * timeline.beatsPerBar;
}
export function snapBar(value: number, step = 1) {
  return Math.max(0, Math.round(value / step) * step);
}
export function activeTimelineCueId(
  timeline: ShowTimeline,
  cues: readonly ShowCue[],
  elapsedMs: number,
) {
  const validCueIds = new Set(cues.map((cue) => cue.id));
  const position = Math.max(0, elapsedMs) / barMs(timeline);
  const active = timeline.clips
    .filter(
      (clip) =>
        clip.enabled &&
        validCueIds.has(clip.cueId) &&
        position >= clip.startBar &&
        position < clip.startBar + clip.lengthBars,
    )
    .sort(
      (a, b) =>
        a.lane - b.lane ||
        a.startBar - b.startBar ||
        a.id.localeCompare(b.id),
    );
  return active.at(-1)?.cueId ?? null;
}
export function renderShowTimeline(
  timeline: ShowTimeline,
  cues: readonly ShowCue[],
  fixtures: readonly PatchedFixture[],
  elapsedMs: number,
  base: readonly number[],
): DmxUpdate[] {
  // Timeline owns its full frame. No underlying programmer look may leak through a gap.
  const updates = new Map<number, number>(makeUniverse().map((value, i) => [i + 1, value]));
  const duration = barMs(timeline),
    position = Math.max(0, elapsedMs) / duration;
  const active = timeline.clips
    .filter(
      (c) =>
        c.enabled &&
        position >= c.startBar &&
        position < c.startBar + c.lengthBars,
    )
    .sort(
      (a, b) =>
        a.lane - b.lane || a.startBar - b.startBar || a.id.localeCompare(b.id),
    );
  for(const clip of timeline.takeClips ?? []) {
    const local=elapsedMs-clip.startBar*duration+clip.trimInMs;
    if(!clip.enabled || position<clip.startBar || position>=clip.startBar+clip.lengthBars || local>=clip.trimOutMs)continue;
    for(const frame of clip.frames){if(frame.timeMs>local)break;for(const [channel,value] of frame.updates)updates.set(channel,value);}
  }
  for (const clip of active) {
    const cue = cues.find((c) => c.id === clip.cueId);
    if (!cue) continue;
    const local = elapsedMs - clip.startBar * duration;
    const fade = cue.fadeMs ? Math.min(1, local / cue.fadeMs) : 1;
    const changes =
      cue.changes ?? cue.universe?.map((v, i) => [i + 1, v] as DmxUpdate) ?? [];
    changes.forEach(([c, v]) =>
      updates.set(c, (updates.get(c) ?? 0) + (v - (updates.get(c) ?? 0)) * fade),
    );
    renderEffectStack(
      cue.effectStack ?? [],
      fixtures,
      local,
      applyUniverseUpdates(makeUniverse(), [...updates.entries()]),
      timeline.bpm,
    ).forEach(([c, v]) => updates.set(c, v));
  }
  return [...updates.entries()];
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const hex = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export function isEffectRecipe(value: unknown): value is CustomEffect {
  if (!value || typeof value !== "object") return false;
  const e = value as CustomEffect;
  const lane = (
    l: CustomEffect["lanes"] extends (infer L)[] | undefined ? L : never,
  ) =>
    l &&
    typeof l === "object" &&
    [
      "red",
      "green",
      "blue",
      "white",
      "amber",
      "uv",
      "dimmer",
      "pan",
      "tilt",
      "strobe",
      "zoom",
      "focus",
      "gobo",
      "colorWheel",
      "panFine",
      "tiltFine",
      "movementSpeed",
      "prism",
      "iris",
      "goboRotate",
      "prismRotate",
      "macro",
    ].includes(l.parameter) &&
    finite(l.depth, 0, 100) &&
    finite(l.offset, -100, 100) &&
    ["sine", "triangle", "square", "saw", "reverse-saw", "step"].includes(
      l.waveform,
    ) &&
    (l.steps === undefined || (Array.isArray(l.steps) && l.steps.length <= 64 && l.steps.every(s => s && finite(s.value,0,100)))) &&
    (l.phaseOffset === undefined || finite(l.phaseOffset,-32,32)) &&
    (l.rateMultiplier === undefined || finite(l.rateMultiplier,0.125,8)) &&
    (l.mode === undefined || ["absolute","relative"].includes(l.mode));
  return (
    typeof e.id === "string" &&
    typeof e.name === "string" &&
    ["dimmer", "pan", "tilt", "uv", "position", "color"].includes(
      e.parameter,
    ) &&
    ["sine", "triangle", "square", "saw", "reverse-saw", "step"].includes(
      e.waveform,
    ) &&
    finite(e.bpm, 20, 300) &&
    finite(e.depth, 0, 100) &&
    finite(e.offset, -100, 100) &&
    finite(e.phaseSpread, 0, 200) &&
    (e.gridPhaseMode === undefined ||
      [
        "selection",
        "rows",
        "columns",
        "across-rows",
        "across-columns",
      ].includes(e.gridPhaseMode)) &&
    (e.colorPalette === undefined ||
      (Array.isArray(e.colorPalette) &&
        e.colorPalette.length <= 64 &&
        e.colorPalette.every(hex))) &&
    (e.colorBlend === undefined || ["smooth", "step"].includes(e.colorBlend)) &&
    (e.motionShape === undefined ||
      [
        "circle",
        "figure-eight",
        "diagonal",
        "pan-sweep",
        "tilt-sweep",
      ].includes(e.motionShape)) &&
    [e.blocks, e.groups, e.wings, e.shift].every(
      (v) => v === undefined || (typeof v === "number" && Number.isFinite(v)),
    ) &&
    (e.cycleBeats === undefined || finite(e.cycleBeats, 0.0625, 32)) &&
    (e.lanes === undefined ||
      (Array.isArray(e.lanes) &&
        e.lanes.length <= 16 &&
        e.lanes.every(lane))) &&
    (e.steps === undefined ||
      (Array.isArray(e.steps) &&
        e.steps.length <= 64 &&
        e.steps.every((s) => s && finite(s.value, 0, 100)))) &&
    (e.orderMode === undefined ||
      [
        "forward",
        "reverse",
        "center-out",
        "outside-in",
        "odd-even",
        "even-odd",
        "mirror-pairs",
      ].includes(e.orderMode)) &&
    (e.direction === undefined ||
      ["forward", "reverse"].includes(e.direction)) &&
    (e.mode === undefined || ["absolute", "relative"].includes(e.mode))
  );
}
export function isEffectStack(value: unknown): value is EffectStackLayer[] {
  return (
    Array.isArray(value) &&
    value.length <= 9 &&
    value.every(
      (l) =>
        l &&
        typeof l.id === "string" &&
        typeof l.name === "string" &&
        Array.isArray(l.targetIds) &&
        l.targetIds.every((id: unknown) => typeof id === "string") &&
        isEffectRecipe(l.effect) &&
        (l.enabled === undefined || typeof l.enabled === "boolean") &&
        (l.phaseOffsetBeats === undefined || finite(l.phaseOffsetBeats, -32, 32)) &&
        (l.selectionGrid === undefined ||
          (l.selectionGrid &&
            finite(l.selectionGrid.rows, 1, 256) &&
            finite(l.selectionGrid.columns, 1, 32) &&
            ["row", "column", "snake-row", "snake-column"].includes(
              l.selectionGrid.traversal,
            ) &&
            Array.isArray(l.selectionGrid.cells) &&
            l.selectionGrid.cells.every(
              (c: { fixtureId: string; row: number; column: number }) =>
                c &&
                typeof c.fixtureId === "string" &&
                finite(c.row, 0, 255) &&
                finite(c.column, 0, 31),
            ))),
    )
  );
}
export function isShowSection(value: unknown): value is ShowSection {
  if (!value || typeof value !== "object") return false;
  const s = value as ShowSection;
  return (
    ["id", "song", "name", "groupId", "recipeId"].every(
      (k) => typeof s[k as keyof ShowSection] === "string",
    ) &&
    (s.primaryEffect === undefined || isEffectRecipe(s.primaryEffect)) &&
    (s.notes === undefined || (typeof s.notes === "string" && s.notes.length <= 4000)) &&
    hex(s.color) &&
    finite(s.intensity, 0, 100) &&
    finite(s.bpm, 20, 300) &&
    finite(s.bars, 0.25, 512) &&
    finite(s.fadeMs, 0, 60000) &&
    finite(s.energy, 0, 100) &&
    Array.isArray(s.layers) &&
    s.layers.length <= 8 &&
    s.layers.every(
      (l) =>
        l &&
        typeof l.id === "string" &&
        typeof l.recipeId === "string" &&
        typeof l.groupId === "string" &&
        finite(l.energy, 0, 100) &&
        (l.customEffect === undefined || isEffectRecipe(l.customEffect)) &&
        (l.stepEditor === undefined || typeof l.stepEditor === "boolean") &&
        (l.intensity === undefined || finite(l.intensity, 0, 100)) &&
        (l.color === undefined || hex(l.color)) &&
        (l.cycleBeats === undefined || finite(l.cycleBeats, 0.0625, 32)) &&
        (l.rateMultiplier === undefined || finite(l.rateMultiplier, 0.25, 8)) &&
        (l.phaseOffsetBeats === undefined || finite(l.phaseOffsetBeats, -32, 32)) &&
        (l.phaseSpread === undefined || finite(l.phaseSpread, 0, 200)) &&
        (l.offset === undefined || finite(l.offset, -100, 100)) &&
        (l.direction === undefined || ['forward','reverse'].includes(l.direction)) &&
        (l.motionShape === undefined || ['circle','figure-eight','diagonal','pan-sweep','tilt-sweep'].includes(l.motionShape)) &&
        typeof l.enabled === "boolean",
    )
  );
}
function validAssetClip(value:unknown): value is TimelineMediaClip {
  if(!value || typeof value!=='object')return false;
  const c=value as TimelineMediaClip;
  return typeof c.id==='string' && typeof c.name==='string' && finite(c.startBar,0,100000) && finite(c.lengthBars,.0001,100000)
    && finite(c.durationMs,1,86400000) && finite(c.trimInMs,0,c.durationMs) && finite(c.trimOutMs,c.trimInMs+1,c.durationMs) && typeof c.enabled==='boolean';
}
function validTakeClip(value:unknown): value is TimelineTakeClip {
  if(!validAssetClip(value))return false;
  const c=value as unknown as TimelineTakeClip;
  return typeof c.recordingId==='string' && Array.isArray(c.frames) && c.frames.length<=30000 && c.frames.every((frame,index)=>
    frame && finite(frame.timeMs,0,c.durationMs) && (!index || frame.timeMs>=c.frames[index-1].timeMs) && Array.isArray(frame.updates) && frame.updates.length<=512 && frame.updates.every(u=>Array.isArray(u) && u.length===2 && Number.isInteger(u[0]) && finite(u[0],1,512) && finite(u[1],0,255)));
}
export function isShowTimeline(value: unknown): value is ShowTimeline {
  if (!value || typeof value !== "object") return false;
  const t = value as ShowTimeline;
  return (
    (t.videoClips===undefined || (Array.isArray(t.videoClips) && t.videoClips.length<=100 && t.videoClips.every(c=>validAssetClip(c) && typeof c.mediaId==='string'))) &&
    (t.takeClips===undefined || (Array.isArray(t.takeClips) && t.takeClips.length<=24 && t.takeClips.every(validTakeClip))) &&
    finite(t.bpm, 20, 300) &&
    finite(t.beatsPerBar, 1, 12) &&
    Number.isInteger(t.beatsPerBar) &&
    finite(t.audioOffsetBars, 0, 100000) &&
    (t.audioName === undefined || typeof t.audioName === "string") &&
    (t.audioTrimInMs === undefined || finite(t.audioTrimInMs, 0, 86400000)) &&
    (t.audioTrimOutMs === undefined || (finite(t.audioTrimOutMs, 0, 86400000) && t.audioTrimOutMs > (t.audioTrimInMs ?? 0))) &&
    Array.isArray(t.clips) &&
    t.clips.length <= 1000 &&
    t.clips.every(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.cueId === "string" &&
        finite(c.startBar, 0, 100000) &&
        finite(c.lengthBars, 0.25, 100000) &&
        finite(c.lane, 0, 7) &&
        Number.isInteger(c.lane) &&
        typeof c.enabled === "boolean",
    )
  );
}
