import { describe, expect, it } from 'vitest';
import { classifyDesktopPlatform } from './supabase-client';

describe('desktop platform identity', () => {
  it('detects Windows WebView/desktop user agents', () => {
    expect(classifyDesktopPlatform('Win32 Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
  });

  it('detects macOS desktop user agents', () => {
    expect(classifyDesktopPlatform('MacIntel Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos');
  });

  it('detects Linux desktop user agents', () => {
    expect(classifyDesktopPlatform('Linux x86_64')).toBe('linux');
  });

  it('falls back safely for unknown desktop platforms', () => {
    expect(classifyDesktopPlatform('unknown runtime')).toBe('desktop');
  });
});
