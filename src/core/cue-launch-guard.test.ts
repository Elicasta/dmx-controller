import { describe, expect, it } from "vitest";
import { CueLaunchGuard } from "./cue-launch-guard";

describe("CueLaunchGuard", () => {
  it("rejects a stale delayed callback after a newer cue takes ownership", () => {
    const guard = new CueLaunchGuard();
    const old = guard.begin("cue-a", true)!;
    const next = guard.begin("cue-b", false)!;
    expect(guard.isCurrent(old)).toBe(false);
    expect(guard.markLaunched(old)).toBe(false);
    expect(guard.markLaunched(next)).toBe(true);
  });

  it("does not stack the same delayed cue twice", () => {
    const guard = new CueLaunchGuard();
    expect(guard.begin("cue-a", true)).toBeTypeOf("number");
    expect(guard.pendingCueId).toBe("cue-a");
    expect(guard.begin("cue-a", true)).toBeNull();
  });

  it("invalidates pending callbacks when the operator cancels", () => {
    const guard = new CueLaunchGuard();
    const token = guard.begin("cue-a", true)!;
    guard.cancel();
    expect(guard.pendingCueId).toBeNull();
    expect(guard.isCurrent(token)).toBe(false);
  });
});
