import { invoke } from '@tauri-apps/api/core';
import type { OutputDriver, OutputDriverStatus } from './output-router';

export type SacnOutputConfig = {
  enabled: boolean;
  target: string;
};

export type SacnFrameSender = (
  target: string,
  universe: number,
  values: readonly number[]
) => Promise<void>;

const nativeSender: SacnFrameSender = async (target, universe, values) => {
  await invoke('send_sacn_frame', { target, universe, values: Array.from(values) });
};

/** Independent network output; never stop USB DMX or the virtual driver on send failure. */
export class SacnOutputDriver implements OutputDriver {
  readonly id = 'sacn';
  readonly name = 'sACN (E1.31) output';

  private framesSent = 0;
  private lastError: string | undefined;

  constructor(
    private readonly config: () => SacnOutputConfig,
    private readonly sender: SacnFrameSender = nativeSender
  ) {}

  async sendFrame(universe: number, frame: readonly number[]): Promise<void> {
    const { enabled, target } = this.config();
    if (!enabled) return;
    try {
      await this.sender(target.trim() || 'multicast', universe, frame);
      this.framesSent += 1;
      this.lastError = undefined;
    } catch (error) {
      this.lastError = String(error);
    }
  }

  status(): OutputDriverStatus {
    return { id: this.id, name: this.name, framesSent: this.framesSent, lastError: this.lastError };
  }
}
