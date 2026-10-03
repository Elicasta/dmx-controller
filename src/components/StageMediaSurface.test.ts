import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestStageVideoInputs, resolveStageVideoInputDevice, StageVideoInputError, stageVideoReconnectDelay } from './StageMediaSurface';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NDI live recovery', () => {
  it('follows the same named virtual input when its device id changes after restart', () => {
    expect(resolveStageVideoInputDevice(
      { kind: 'ndi', deviceId: 'old-device', sourceName: 'NDI Webcam Input' },
      [{ deviceId: 'new-device', label: 'NDI Webcam Input' }],
    )).toBe('new-device');
  });

  it('keeps the selected device id when it is still present', () => {
    expect(resolveStageVideoInputDevice(
      { kind: 'ndi', deviceId: 'selected', sourceName: 'NDI Webcam Input' },
      [
        { deviceId: 'selected', label: 'Camera A' },
        { deviceId: 'other', label: 'NDI Webcam Input' },
      ],
    )).toBe('selected');
  });

  it('backs off transient failures but never loops on blocked permission', () => {
    expect(stageVideoReconnectDelay(new DOMException('busy', 'NotReadableError'), 0)).toBe(500);
    expect(stageVideoReconnectDelay(new DOMException('busy', 'NotReadableError'), 8)).toBe(4000);
    expect(stageVideoReconnectDelay(new StageVideoInputError('permission-denied', 'blocked'), 0)).toBeNull();
    expect(stageVideoReconnectDelay(new StageVideoInputError('unsupported', 'unsupported'), 0)).toBeNull();
  });
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
