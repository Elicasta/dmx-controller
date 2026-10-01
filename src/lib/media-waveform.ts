export type Waveform = { version: 1; durationMs: number; peaks: number[] };
const MAX_PEAKS = 360000;
export function peakWindow(channels: readonly Float32Array[], start: number, end: number): number {
  let peak = 0;
  for (const channel of channels)
    for (let i = start; i < Math.min(end, channel.length); i++) {
      const value = Math.abs(channel[i]);
      if (Number.isFinite(value)) peak = Math.max(peak, value);
    }
  return Math.min(1, peak);
}
/** Every sample in every channel contributes; quiet left channels cannot hide right-channel hits. */
export async function buildWaveform(buffer: Pick<AudioBuffer, 'duration' | 'length' | 'numberOfChannels' | 'getChannelData'>): Promise<Waveform> {
  const count = Math.max(1, Math.min(MAX_PEAKS, Math.ceil(buffer.duration * 100), buffer.length));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    peaks.push(peakWindow(channels, Math.floor(i * buffer.length / count), Math.floor((i + 1) * buffer.length / count)));
    if (i % 2048 === 2047) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return { version: 1, durationMs: buffer.duration * 1000, peaks };
}
/** Render enough peaks for the visible pixel density without losing the strongest transient. */
export function displayPeaks(wave: Waveform, startMs: number, endMs: number, pixels: number): number[] {
  const start = Math.max(0, Math.floor(startMs / wave.durationMs * wave.peaks.length));
  const end = Math.min(wave.peaks.length, Math.ceil(endMs / wave.durationMs * wave.peaks.length));
  const count = Math.min(Math.max(1, Math.ceil(pixels)), Math.max(0, end - start), 12000);
  return Array.from({ length: count }, (_, i) => {
    let peak = 0;
    for (let j = start + Math.floor(i * (end - start) / count); j < start + Math.floor((i + 1) * (end - start) / count); j++)
      peak = Math.max(peak, wave.peaks[j]);
    return peak;
  });
}
const inFlight = new Map<string, Promise<Waveform>>();
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lumarig-waveforms', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('peaks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Waveform cache is busy.'));
  });
}
export async function waveformForBlob(blob: Blob): Promise<Waveform> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const key = 'v1:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = (async () => {
    let db: IDBDatabase | undefined;
    try {
      try {
        db = await database();
        const cached = await new Promise<Waveform | undefined>((resolve, reject) => {
          const request = db!.transaction('peaks').objectStore('peaks').get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (cached?.version === 1 && Number.isFinite(cached.durationMs) && cached.durationMs > 0 &&
            Array.isArray(cached.peaks) && cached.peaks.length <= MAX_PEAKS &&
            cached.peaks.every(p => Number.isFinite(p) && p >= 0 && p <= 1)) return cached;
      } catch { /* Cache failure never blocks playback or analysis. */ }
      const context = new AudioContext();
      let wave: Waveform;
      try { wave = await buildWaveform(await context.decodeAudioData(bytes)); }
      finally { await context.close(); }
      if (db) {
        try {
          await new Promise<void>((resolve, reject) => {
            const tx = db!.transaction('peaks', 'readwrite');
            tx.objectStore('peaks').put(wave, key);
            tx.oncomplete = () => resolve();
            tx.onerror = tx.onabort = () => reject(tx.error);
          });
        } catch { /* Peaks still remain usable when disk space is exhausted. */ }
      }
      return wave;
    } finally { db?.close(); }
  })();
  inFlight.set(key, task);
  try { return await task; } finally { inFlight.delete(key); }
}
