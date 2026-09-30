import { describe, it, expect } from "vitest";
import {
  DEFAULT_PATCH,
  parameterChannel,
  type PatchedFixture,
} from "./fixtures";
import { makeUniverse, applyUniverseUpdates } from "./dmx";
import { makeSelectionGrid, selectionGridPhases } from "../core/selection-grid";
import {
  EMPTY_SHOW,
  sanitizeShow,
  isShowFile,
  type FixtureGroup,
} from "./show";
import {
  createSection,
  buildSectionCues,
  sectionStack,
  renderEffectStack,
  renderShowTimeline,
  activeTimelineCueId,
  barMs,
  snapBar,
  FX_RECIPES,
  EMPTY_TIMELINE,
  isShowTimeline,
  isEffectRecipe,
} from "./show-design";
const fixtures: PatchedFixture[] = Array.from({ length: 4 }, (_, i) => ({
  ...DEFAULT_PATCH[0],
  id: `f${i}`,
  name: `Wash ${i}`,
  address: 1 + i * 6,
  selected: true,
  group: "Wash",
}));
const group: FixtureGroup = {
  id: "wash",
  name: "Wash",
  labelColor: "#145dff",
  masterDefault: 100,
  fxEnabled: true,
  notes: "",
  fixtureOrder: fixtures.map((f) => f.id),
  selectionGrid: makeSelectionGrid(
    fixtures.map((f) => f.id),
    2,
  ),
};
const frame = makeUniverse();
const section = () => ({
  ...createSection("Chorus", "Song", "wash", 120),
  intensity: 60,
  energy: 100,
  recipeId: "row-chase",
});
function value(
  updates: readonly (readonly [number, number])[],
  fixture: PatchedFixture,
  parameter: "dimmer" | "red" = "dimmer",
) {
  return new Map(updates).get(parameterChannel(fixture, parameter)!);
}
describe("solo show design", () => {
  it("phases whole rows by identity when selection is reordered", () => {
    expect(
      selectionGridPhases(
        group.selectionGrid,
        ["f3", "f0", "f2", "f1"],
        "rows",
      ),
    ).toEqual([0.5, 0, 0.5, 0]);
  });
  it("phases columns and parallel row waves without duplicating the last phase", () => {
    expect(
      selectionGridPhases(group.selectionGrid, group.fixtureOrder, "columns"),
    ).toEqual([0, 0.5, 0, 0.5]);
    expect(
      selectionGridPhases(
        group.selectionGrid,
        group.fixtureOrder,
        "across-rows",
      ),
    ).toEqual([0, 0.5, 0, 0.5]);
  });
  it("renders each whole row in phase and the next row separately", () => {
    const u = renderEffectStack(
      sectionStack(section(), fixtures, [group]),
      fixtures,
      0,
      frame,
    );
    expect(value(u, fixtures[0])).toBe(153);
    expect(value(u, fixtures[1])).toBe(153);
    expect(value(u, fixtures[2])).toBe(0);
    expect(value(u, fixtures[3])).toBe(0);
  });
  it("scales dimmer FX to the section intensity ceiling", () => {
    const s = { ...section(), intensity: 20 };
    const u = renderEffectStack(
      sectionStack(s, fixtures, [group]),
      fixtures,
      0,
      frame,
    );
    expect(value(u, fixtures[0])).toBe(51);
  });
  it("layers color over a row chase without losing intensity", () => {
    const s = section();
    s.layers = [
      {
        id: "color",
        recipeId: "ocean",
        groupId: "wash",
        energy: 100,
        enabled: true,
      },
    ];
    const u = renderEffectStack(
      sectionStack(s, fixtures, [group]),
      fixtures,
      0,
      frame,
    );
    expect(value(u, fixtures[0])).toBe(153);
    expect(value(u, fixtures[0], "red")).toBe(20);
  });
  it("keeps separate targets and lights an added target group", () => {
    const s = { ...section(), groupId: "first" };
    const first = { ...group, id: "first", fixtureOrder: ["f0", "f1"] },
      second = { ...group, id: "second", fixtureOrder: ["f2", "f3"] };
    s.layers = [
      {
        id: "other",
        recipeId: "ocean",
        groupId: "second",
        energy: 80,
        enabled: true,
      },
    ];
    const cue = buildSectionCues([s], fixtures, [first, second])[0];
    expect(value(cue.changes!, fixtures[3])).toBe(153);
    const u = renderEffectStack(cue.effectStack!, fixtures, 0, frame);
    expect(value(u, fixtures[0], "red")).toBeUndefined();
    expect(value(u, fixtures[2], "red")).toBe(16);
  });
  it("empty or deleted FX targets never fall back to the whole rig", () => {
    const layer = sectionStack(section(), fixtures, [group])[0];
    expect(
      renderEffectStack([{ ...layer, targetIds: [] }], fixtures, 0, frame),
    ).toEqual([]);
    expect(
      renderEffectStack(
        [{ ...layer, targetIds: ["missing"] }],
        fixtures,
        0,
        frame,
      ),
    ).toEqual([]);
  });
  it("disabled layers do not write channels", () => {
    const layer = sectionStack(section(), fixtures, [group])[0];
    expect(
      renderEffectStack([{ ...layer, enabled: false }], fixtures, 0, frame),
    ).toEqual([]);
  });
  it("rejects missing groups and row effects without a grid target", () => {
    expect(() =>
      sectionStack({ ...section(), groupId: "gone" }, fixtures, [group]),
    ).toThrow("missing");
    expect(() =>
      sectionStack({ ...section(), groupId: "" }, fixtures, [group]),
    ).toThrow("Row FX");
  });
  it("rejects movement on a wash-only rig", () => {
    expect(() =>
      sectionStack({ ...section(), recipeId: "circle" }, fixtures, [group]),
    ).toThrow("moving");
  });
  it("builds repeatable cue identities and self-contained sparse instructions", () => {
    const s = section(),
      first = buildSectionCues([s], fixtures, [group]);
    const next = buildSectionCues(
      [{ ...s, name: "Revised" }],
      fixtures,
      [group],
      first,
    );
    expect(next[0].id).toBe(first[0].id);
    expect(next[0].sourceSectionId).toBe(s.id);
    expect(next[0].changes!.length).toBeGreaterThan(0);
    expect(next[0].name).toContain("Revised");
  });
  it("round-trips the creator draft, timeline and stack through show validation", () => {
    const s = section(),
      cues = buildSectionCues([s], fixtures, [group]);
    const show = sanitizeShow({
      ...EMPTY_SHOW,
      cues,
      creatorSections: [s],
      timeline: {
        ...EMPTY_TIMELINE,
        clips: [
          {
            id: "clip",
            cueId: cues[0].id,
            startBar: 1,
            lengthBars: 8,
            lane: 0,
            enabled: true,
          },
        ],
      },
    });
    expect(isShowFile(show)).toBe(true);
    expect(show.timeline?.clips).toHaveLength(1);
    expect(show.creatorSections?.[0].id).toBe(s.id);
    expect(show.cues[0].effectStack).toHaveLength(1);
  });
  it("all library recipes remain importable", () => {
    expect(FX_RECIPES.every((r) => isEffectRecipe(r.effect))).toBe(true);
  });
  it("invalid numbers and imported grid shapes are rejected", () => {
    expect(isShowTimeline({ ...EMPTY_TIMELINE, bpm: NaN })).toBe(false);
    expect(
      isShowFile({
        ...EMPTY_SHOW,
        cues: [
          {
            ...buildSectionCues([section()], fixtures, [group])[0],
            effectStack: [
              {
                id: "x",
                name: "x",
                targetIds: [],
                effect: FX_RECIPES[0].effect,
                selectionGrid: { cells: null },
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });
});
describe("audio bar timeline engine", () => {
  const s = { ...section(), recipeId: "", fadeMs: 0 },
    cues = buildSectionCues([s], fixtures, [group]);
  const clip = {
    id: "clip",
    cueId: cues[0].id,
    startBar: 2,
    lengthBars: 4,
    lane: 0,
    enabled: true,
  };
  const timeline = { ...EMPTY_TIMELINE, bpm: 120, clips: [clip] };
  it("converts beats and tempo to bar duration and snaps positions", () => {
    expect(barMs(timeline)).toBe(2000);
    expect(snapBar(2.4, 1)).toBe(2);
    expect(snapBar(2.4, 0.25)).toBe(2.5);
    expect(snapBar(-2)).toBe(0);
  });
  it("tracks the cue that owns the final rendered timeline layer", () => {
    const other = { ...cues[0], id: "top" };
    const overlapping = {
      ...timeline,
      clips: [
        clip,
        { ...clip, id: "top-clip", cueId: "top", lane: 1 },
      ],
    };
    expect(activeTimelineCueId(overlapping, [...cues, other], 5000)).toBe("top");
    expect(activeTimelineCueId(overlapping, [...cues, other], 3999)).toBeNull();
    expect(activeTimelineCueId(
      { ...overlapping, clips: [{ ...overlapping.clips[1], enabled: false }] },
      [...cues, other],
      5000,
    )).toBeNull();
  });
  it("has exact clip boundaries and releases its channels outside a clip", () => {
    expect(renderShowTimeline(timeline, cues, fixtures, 3999, frame)).toEqual(
      [],
    );
    expect(
      renderShowTimeline(timeline, cues, fixtures, 4000, frame).length,
    ).toBeGreaterThan(0);
    expect(renderShowTimeline(timeline, cues, fixtures, 12000, frame)).toEqual(
      [],
    );
  });
  it("renders seeks deterministically at the same song position", () => {
    const dynamic = buildSectionCues([section()], fixtures, [group]);
    const t = { ...timeline, clips: [{ ...clip, cueId: dynamic[0].id }] };
    const one = renderShowTimeline(t, dynamic, fixtures, 5500, frame);
    renderShowTimeline(t, dynamic, fixtures, 9500, frame);
    expect(renderShowTimeline(t, dynamic, fixtures, 5500, frame)).toEqual(one);
  });
  it("lower lanes override shared channels while preserving others", () => {
    const other = {
      ...cues[0],
      id: "color",
      changes: [[1, 99]] as [number, number][],
    };
    const t = {
      ...timeline,
      clips: [clip, { ...clip, id: "lower", cueId: "color", lane: 1 }],
    };
    const u = renderShowTimeline(t, [...cues, other], fixtures, 5000, frame);
    expect(new Map(u).get(1)).toBe(99);
    expect(value(u, fixtures[0])).toBe(153);
  });
  it("fades independent cues from the captured base", () => {
    const cue = { ...cues[0], fadeMs: 1000 };
    expect(
      value(
        renderShowTimeline(timeline, [cue], fixtures, 4500, frame),
        fixtures[0],
      ),
    ).toBeCloseTo(76.5);
  });
  it("ignores removed cues and disabled clips", () => {
    expect(renderShowTimeline(timeline, [], fixtures, 5000, frame)).toEqual([]);
    expect(
      renderShowTimeline(
        { ...timeline, clips: [{ ...clip, enabled: false }] },
        cues,
        fixtures,
        5000,
        frame,
      ),
    ).toEqual([]);
  });
  it("uses the global timeline tempo for every FX layer", () => {
    const dynamic = buildSectionCues([section()], fixtures, [group]);
    const t = {
      ...timeline,
      bpm: 60,
      clips: [{ ...clip, startBar: 0, cueId: dynamic[0].id }],
    };
    const expected = renderEffectStack(
      dynamic[0].effectStack!,
      fixtures,
      1000,
      frame,
      60,
    );
    const rendered = renderShowTimeline(t, dynamic, fixtures, 1000, frame);
    expect(value(rendered, fixtures[0])).toBe(value(expected, fixtures[0]));
  });
});

describe("editable color phasers", () => {
  it("writes RGB without overwriting dimmer", () => {
    const layer = {
      id: "color",
      name: "Color",
      targetIds: fixtures.map((f) => f.id),
      effect: {
        ...FX_RECIPES.find((r) => r.id === "ocean")!.effect,
        phaseSpread: 0,
      },
    };
    const u = renderEffectStack([layer], fixtures, 0, frame);
    expect(value(u, fixtures[0], "red")).toBe(20);
    expect(value(u, fixtures[0])).toBeUndefined();
  });
  it("blends palette colors continuously and scales layer energy", () => {
    const s = { ...section(), recipeId: "ocean", energy: 50 };
    const layers = sectionStack(s, fixtures, [group]);
    layers[0].effect.phaseSpread = 0;
    const start = renderEffectStack(layers, fixtures, 0, frame),
      mid = renderEffectStack(layers, fixtures, 1000, frame);
    expect(value(start, fixtures[0], "red")).toBe(10);
    expect(value(mid, fixtures[0], "red")).toBe(5);
  });
});
