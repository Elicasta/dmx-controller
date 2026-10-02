import { invoke } from '@tauri-apps/api/core';

export type ProPresenterStatus = {
  baseUrl: string;
  version: unknown;
  slide: unknown;
  activePresentation: unknown;
  presentationTransport: unknown;
};

const STORAGE_KEY = 'lumarig.propresenter-api.v1';
const DEFAULT_URL = 'http://127.0.0.1:50001';

export function loadProPresenterUrl() {
  if (typeof window === 'undefined') return DEFAULT_URL;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)?.trim();
    return value && /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(value) ? value : DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export function saveProPresenterUrl(value: string) {
  try { window.localStorage.setItem(STORAGE_KEY, value.trim().replace(/\/$/, '')); } catch {}
}

export async function readProPresenterStatus(baseUrl: string) {
  return invoke<ProPresenterStatus>('propresenter_status', { baseUrl });
}

export async function sendProPresenterCommand(
  baseUrl: string,
  operation: 'next' | 'previous' | 'retrigger' | 'play' | 'pause' | 'timeline-play' | 'timeline-pause' | 'timeline-rewind'
) {
  return invoke<unknown>('propresenter_command', { baseUrl, operation });
}

function findString(value: unknown, keys: readonly string[]): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  }
  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') {
      const found = findString(child, keys);
      if (found) return found;
    }
  }
  return '';
}

export function proPresenterSummary(status: ProPresenterStatus) {
  const presentation = findString(status.activePresentation, ['name', 'presentation_name', 'presentationName']);
  const current = findString(status.slide, ['current', 'current_text', 'currentText', 'text']);
  return {
    presentation,
    current: current.slice(0, 120),
  };
}
