export type AbletonLocator = {
  id: string;
  name: string;
  /** Arrangement position in quarter-note beats from the start of the Live Set. */
  beat: number;
};

export type AbletonLiveSnapshot = {
  setId: string;
  setName: string;
  bpm: number;
  /** Length of one Arrangement bar in quarter-note beats. 6/8 = 3, 7/8 = 3.5. */
  beatsPerBar: number;
  signatureNumerator?: number;
  signatureDenominator?: number;
  currentBeat: number;
  playing: boolean;
  locators: AbletonLocator[];
};

export type AbletonTimelineMarker = AbletonLocator & {
  bar: number;
};

const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function abletonBeatToBar(beat: number, beatsPerBar: number) {
  const safeBeat = Math.max(0, finite(beat, 0));
  const safeBeatsPerBar = clamp(finite(beatsPerBar, 4), 0.25, 128);
  return safeBeat / safeBeatsPerBar;
}

export function sanitizeAbletonSnapshot(value: unknown): AbletonLiveSnapshot {
  const source = value && typeof value === 'object' ? value as Partial<AbletonLiveSnapshot> : {};
  const beatsPerBar = clamp(finite(source.beatsPerBar, 4), 0.25, 128);
  const numerator = source.signatureNumerator == null
    ? undefined
    : clamp(Math.round(finite(source.signatureNumerator, 4)), 1, 99);
  const denominator = source.signatureDenominator == null
    ? undefined
    : clamp(Math.round(finite(source.signatureDenominator, 4)), 1, 64);
  const locators = Array.isArray(source.locators)
    ? source.locators.slice(0, 512).flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const locator = item as Partial<AbletonLocator>;
        const beat = clamp(finite(locator.beat, 0), 0, 10_000_000);
        const name = typeof locator.name === 'string'
          ? locator.name.trim().slice(0, 120)
          : '';
        const id = typeof locator.id === 'string' && locator.id.trim()
          ? locator.id.trim().slice(0, 160)
          : `locator-${beat.toFixed(4)}-${index}`;
        return [{ id, name: name || `Locator ${index + 1}`, beat }];
      })
    : [];

  return {
    setId: typeof source.setId === 'string' ? source.setId.slice(0, 200) : '',
    setName: typeof source.setName === 'string' ? source.setName.slice(0, 200) : '',
    bpm: clamp(finite(source.bpm, 120), 20, 300),
    beatsPerBar,
    signatureNumerator: numerator,
    signatureDenominator: denominator,
    currentBeat: clamp(finite(source.currentBeat, 0), 0, 10_000_000),
    playing: Boolean(source.playing),
    locators: locators.sort((a, b) => a.beat - b.beat || a.name.localeCompare(b.name)),
  };
}

export function abletonTimelineMarkers(snapshot: AbletonLiveSnapshot): AbletonTimelineMarker[] {
  const safe = sanitizeAbletonSnapshot(snapshot);
  return safe.locators.map((locator) => ({
    ...locator,
    bar: abletonBeatToBar(locator.beat, safe.beatsPerBar),
  }));
}

export function activeAbletonLocator(
  snapshot: AbletonLiveSnapshot,
  currentBeat = snapshot.currentBeat,
): AbletonLocator | null {
  const safe = sanitizeAbletonSnapshot({ ...snapshot, currentBeat });
  let active: AbletonLocator | null = null;
  for (const locator of safe.locators) {
    if (locator.beat > safe.currentBeat) break;
    active = locator;
  }
  return active;
}

export function abletonTimelinePositionBar(snapshot: AbletonLiveSnapshot) {
  const safe = sanitizeAbletonSnapshot(snapshot);
  return abletonBeatToBar(safe.currentBeat, safe.beatsPerBar);
}

/**
 * Converts Ableton's musical bar position into the elapsed-ms coordinate used by
 * the current LumaRig Timeline. This keeps bars aligned even when the Live Set
 * meter differs from the saved LumaRig Timeline meter.
 */
export function abletonTimelineElapsedMs(
  snapshot: AbletonLiveSnapshot,
  timelineBeatsPerBar: number,
  timelineBpm: number,
  lightingOffsetMs = 0,
) {
  const safe = sanitizeAbletonSnapshot(snapshot);
  const externalBarMs = 60000 / safe.bpm * safe.beatsPerBar;
  const timelineBarMs = 60000 / clamp(finite(timelineBpm, 120), 20, 300)
    * clamp(finite(timelineBeatsPerBar, 4), 0.25, 128);
  const rawBar = abletonTimelinePositionBar(safe);
  const offsetBars = finite(lightingOffsetMs, 0) / externalBarMs;
  return Math.max(0, rawBar + offsetBars) * timelineBarMs;
}
