export class CueLaunchGuard {
  private generation = 0;
  private pendingId: string | null = null;

  get pendingCueId() {
    return this.pendingId;
  }

  begin(cueId: string, delayed: boolean): number | null {
    if (this.pendingId === cueId) return null;
    this.generation += 1;
    this.pendingId = delayed ? cueId : null;
    return this.generation;
  }

  cancel() {
    this.generation += 1;
    this.pendingId = null;
  }

  markLaunched(token: number) {
    if (!this.isCurrent(token)) return false;
    this.pendingId = null;
    return true;
  }

  isCurrent(token: number) {
    return token === this.generation;
  }
}
