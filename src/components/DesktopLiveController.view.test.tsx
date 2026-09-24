// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopLiveController, type DesktopLiveControllerProps } from './DesktopLiveController';

const noop = () => {};
const props: DesktopLiveControllerProps = {
  showName: 'View Persistence Test', bpm: 120, currentCue: 'Ready', nextCue: 'Cue 1', blackout: false,
  outputHealthy: true, dmxConnected: false, master: 100, fxSpeed: 50, fxDepth: 100,
  fixtures: [], groups: [], looks: [], effects: [],
  onGo: noop, onBack: noop, onBlackout: noop, onMaster: noop, onFxSpeed: noop, onFxDepth: noop,
  onSelectFixtures: noop, onFixtureLevel: noop, onGroupLevel: noop, onFlashFixtures: noop,
  onLook: noop, onEffectPress: noop, onEffectRelease: noop, onStopFx: noop, onColor: noop, onSelectedLevel: noop
};

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('desktop live view', () => {
  it('returns to the same mode and remembers separate pages after the board unmounts', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.append(host);
    let root = createRoot(host);
    act(() => root.render(<DesktopLiveController {...props} />));
    const click = (label: string) => {
      const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      expect(button, label).toBeTruthy();
      act(() => button!.click());
    };
    click('3');
    click('MA');
    expect(host.querySelector('.desk-surface-pages span')?.textContent).toContain('PAGE 1');
    click('2');
    click('FADERS');
    expect(host.querySelector('.desk-surface-pages span')?.textContent).toContain('PAGE 3');
    click('MA');
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<DesktopLiveController {...props} />));
    expect(host.querySelector('.desk-surface-header nav button.active')?.textContent).toBe('MA');
    expect(host.querySelector('.desk-surface-pages span')?.textContent).toContain('PAGE 2');
    act(() => root.unmount());
    host.remove();
  });
});
