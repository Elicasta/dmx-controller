import { invoke } from '@tauri-apps/api/core';
import type { OutputDriver, OutputDriverStatus } from './output-router';

export type ArtNetOutputConfig = {
  enabled: boolean;
  target: string;
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
  readonly id = 'artnet-lumaviz';
  readonly name = 'LumaViz / Art-Net';

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
      await this.sender(config.target, universe, frame);
      this.framesSent += 1;
      this.lastError = undefined;
    } catch (error) {
      this.lastError = String(error);
      throw error;
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
