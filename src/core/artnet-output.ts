import { invoke } from '@tauri-apps/api/core';
import type { OutputDriver, OutputDriverStatus } from './output-router';

export type ArtNetOutputConfig = {
  enabled: boolean;
  target: string;
  blackout?: boolean;
};

export type ArtNetFrameSender = (
  target: string,
  universe: number,
  frame: readonly number[]
) => Promise<void>;

async function defaultSender(
  target: string,
  universe: number,
  frame: readonly number[]
) {
  await invoke('send_artnet_frame', {
    target,
    universe,
    values: Array.from(frame)
  });
}

export class ArtNetOutputDriver implements OutputDriver {
  readonly id = 'artnet';
  readonly name = 'Art-Net output';

  private framesSent = 0;
  private lastError: string | undefined;

  constructor(
    private readonly config: () => ArtNetOutputConfig,
    private readonly sender: ArtNetFrameSender = defaultSender
  ) {}

  async sendFrame(universe: number, frame: readonly number[]) {
    const config = this.config();
    if (!config.enabled) return;

    try {
      const output = config.blackout ? Array.from({ length: 512 }, () => 0) : frame;
      await this.sender(config.target, universe, output);
      this.framesSent += 1;
      this.lastError = undefined;
    } catch (error) {
      // Visualization is intentionally non-fatal. A dead LumaViz target must
      // never turn a valid physical-lighting frame into an output failure.
      this.lastError = String(error);
    }
  }

  status(): OutputDriverStatus {
    return {
      id: this.id,
      name: this.name,
      framesSent: this.framesSent,
      lastError: this.lastError
    };
  }
}
