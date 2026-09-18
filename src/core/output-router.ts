export type OutputDriverStatus = {
  id: string;
  name: string;
  framesSent: number;
  lastError?: string;
};

export interface OutputDriver {
  readonly id: string;
  readonly name: string;
  sendFrame(universe: number, frame: readonly number[]): Promise<void> | void;
  status(): OutputDriverStatus;
}

export class VirtualOutputDriver implements OutputDriver {
  readonly id = 'virtual';
  readonly name = 'Virtual output';
  private framesSent = 0;
  private frames = new Map<number, number[]>();

  sendFrame(universe: number, frame: readonly number[]) {
    this.frames.set(universe, [...frame]);
    this.framesSent += 1;
  }

  frame(universe = 1): readonly number[] | undefined {
    return this.frames.get(universe);
  }

  status(): OutputDriverStatus {
    return { id: this.id, name: this.name, framesSent: this.framesSent };
  }
}

export class CallbackOutputDriver implements OutputDriver {
  private framesSent = 0;
  private lastError: string | undefined;

  constructor(
    readonly id: string,
    readonly name: string,
    private readonly callback: (universe: number, frame: readonly number[]) => Promise<void> | void
  ) {}

  async sendFrame(universe: number, frame: readonly number[]) {
    try {
      await this.callback(universe, frame);
      this.framesSent += 1;
      this.lastError = undefined;
    } catch (error) {
      this.lastError = String(error);
      throw error;
    }
  }

  status(): OutputDriverStatus {
    return { id: this.id, name: this.name, framesSent: this.framesSent, lastError: this.lastError };
  }
}

export class OutputRouter {
  private readonly drivers = new Map<string, OutputDriver>();

  register(driver: OutputDriver) {
    this.drivers.set(driver.id, driver);
  }

  unregister(driverId: string) {
    this.drivers.delete(driverId);
  }

  async route(universe: number, frame: readonly number[]): Promise<void> {
    const results = await Promise.allSettled([...this.drivers.values()].map((driver) => driver.sendFrame(universe, frame)));
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  status(): OutputDriverStatus[] {
    return [...this.drivers.values()].map((driver) => driver.status());
  }
}
