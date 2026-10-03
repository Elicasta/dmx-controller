import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestStageVideoInputs } from './StageMediaSurface';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestStageVideoInputs', () => {
  it('turns the macOS/WebKit permission denial into a recoverable limited result', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockRejectedValue(
          new DOMException(
            'The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.',
            'NotAllowedError',
          ),
        ),
      },
    });

    const result = await requestStageVideoInputs();

    expect(result.permission).toBe('limited');
    expect(result.inputs).toEqual([]);
    expect(result.warning).toMatch(/camera access/i);
    expect(result.warning).not.toMatch(/user agent or the platform/i);
  });

  it('does not request camera permission when named video inputs are already available', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'videoinput', deviceId: 'ndi-1', label: 'NDI Webcam Input' },
        ]),
        getUserMedia,
      },
    });

    await expect(requestStageVideoInputs()).resolves.toEqual({
      inputs: [{ deviceId: 'ndi-1', label: 'NDI Webcam Input' }],
      permission: 'granted',
    });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('stops the temporary permission stream and re-enumerates named inputs', async () => {
    const stop = vi.fn();
    const enumerateDevices = vi.fn()
      .mockResolvedValueOnce([{ kind: 'videoinput', deviceId: 'ndi-1', label: '' }])
      .mockResolvedValueOnce([{ kind: 'videoinput', deviceId: 'ndi-1', label: 'NDI Webcam Input' }]);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices,
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });

    const result = await requestStageVideoInputs();

    expect(result.permission).toBe('granted');
    expect(result.inputs[0]?.label).toBe('NDI Webcam Input');
    expect(stop).toHaveBeenCalledOnce();
    expect(enumerateDevices).toHaveBeenCalledTimes(2);
  });
});
