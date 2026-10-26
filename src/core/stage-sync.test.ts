import { describe, expect, it } from "vitest";
import { assertValidPatch, fixtureIdentity } from "./stage-model";
import { DEFAULT_STAGE_SYNC_POLICY, canAutoApplyDangerousChange, decideIncomingChange, hasRevisionConflict, type StageChange } from "./stage-sync";

const change: StageChange = {
  id: "change-1", entityId: "fixture-uuid-1", entityKind: "fixture", category: "fixturePosition",
  source: "lumaviz", baseRevision: 38, createdAt: "2026-09-21T18:24:00-04:00",
  summary: "Mover 04 position", before: { x: 3.2 }, after: { x: 3.8 }, status: "pending",
};

describe("stage model", () => {
  it("uses UUID rather than patch as identity", () => {
    expect(fixtureIdentity({ uuid: "fixture-uuid-1" })).toBe("fixture-uuid-1");
  });
  it("validates explicit universe/channel patch points", () => {
    expect(() => assertValidPatch({ universe: 1, address: 512 })).not.toThrow();
    expect(() => assertValidPatch({ universe: 1, address: 513 })).toThrow();
    expect(() => assertValidPatch({ universe: 0, address: 1 })).toThrow();
  });
});

describe("stage sync safety", () => {
  it("defaults to review and queues incoming changes", () => {
    expect(DEFAULT_STAGE_SYNC_POLICY.mode).toBe("review");
    expect(decideIncomingChange(DEFAULT_STAGE_SYNC_POLICY, change)).toBe("queue");
  });
  it("never auto-applies patch/profile/calibration through the dangerous-change helper", () => {
    const live = { ...DEFAULT_STAGE_SYNC_POLICY, mode: "live" as const, livePermissions: { fixturePosition: true, scenery: true, patch: true, fixtureProfile: true, calibration: true } };
    expect(canAutoApplyDangerousChange(live, "fixturePosition")).toBe(true);
    expect(canAutoApplyDangerousChange(live, "patch")).toBe(false);
    expect(canAutoApplyDangerousChange(live, "fixtureProfile")).toBe(false);
    expect(canAutoApplyDangerousChange(live, "calibration")).toBe(false);
  });
  it("detects stale edits", () => {
    expect(hasRevisionConflict(39, change)).toBe(true);
    expect(hasRevisionConflict(38, change)).toBe(false);
  });
});
