import type { OutputDriver, OutputDriverStatus } from './output-router';
import type { QlcCommand } from './qlc-websocket';

export type QlcSender = (command: QlcCommand) => void;

/**
 * QLC+ Simple Desk backend for LumaRig's 512-channel universes.
 * The LumaRig engine owns cues/effects. QLC+ owns the physical DMX interface.
 *
 * Only changed channel levels are sent over the QLC+ WebSocket. A bounded
 * 25ms flush coalesces high-frequency frames and prevents an unbounded backlog.
 * A physical QLC+ installation must be tested before using this during a show.
 */
export class QlcOutputDriver implements OutputDriver {
  readonly id = 'qlc';
  readonly name = 'QLC+ external DMX';
  private enabled = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private desired = new Map<number, number[]>();
  private sent = new Map<number, number[]>();
  private framesSent = 0;
  private error: string | undefined;
  private maxCommandsPerTick = 128;

  constructor(private readonly send: QlcSender, private readonly onFault: (error: Error) => void = () => {}) {}

  get active() { return this.enabled; }

  arm(): void {
    this.disarm();
    this.error = undefined;
    this.enabled = true;
    this.timer = setInterval(() => {
      try { this.flush(); }
      catch (error) { this.onFault(error instanceof Error ? error : new Error(String(error))); }
    }, 25);
  }

  disarm(): void {
    this.enabled = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.desired.clear();
    this.sent.clear();
  }

  sendFrame(universe: number, frame: readonly number[]): void {
    if (!this.enabled) return;
    if (!Number.isSafeInteger(universe) || universe < 1 || universe > 512)
      throw new Error('QLC+ universe must be in range 1–512.');
    if (frame.length !== 512 || frame.some(value => !Number.isSafeInteger(value) || value < 0 || value > 255))
      throw new Error('QLC+ requires a validated 512-channel DMX frame.');
    this.desired.set(universe, [...frame]);
  }

  flush(): void {
    if (!this.enabled) return;
    let budget = this.maxCommandsPerTick;
    try {
      for (const [universe, desired] of this.desired) {
        if (budget === 0) break;
        const last = this.sent.get(universe) ?? Array<number>(512).fill(-1);
        for (let i = 0; i < 512 && budget > 0; i++) {
          if (last[i] === desired[i]) continue;
          this.send({type:'channel',address:(universe-1)*512+i+1,value:desired[i]});
          last[i] = desired[i];
          budget--;
        }
        this.sent.set(universe, last);
        if (last.every((value,i) => value===desired[i])) {
          this.framesSent++;
        }
      }
      this.error = undefined;
    } catch (error) {
      this.error = String(error);
      this.disarm();
      throw error;
    }
  }

  status(): OutputDriverStatus {
    return { id:this.id, name:this.name, framesSent:this.framesSent, lastError:this.error };
  }
}
