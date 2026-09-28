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
  it('uses Shift for fine fader adjustment and double click resets the fader', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.append(host);
    const onFixtureLevel = vi.fn();
    const root = createRoot(host);
    act(() => root.render(<DesktopLiveController {...props}
      showName="Fader Interaction Test"
      fixtures={[{ id: 'front-1', name: 'Front 1', subtitle: 'U1 · 001', intensity: 50, outputIntensity: 50, color: '#ffffff', selected: false }]}
      onFixtureLevel={onFixtureLevel}
    />));
    const slider = host.querySelector('[role="slider"]') as HTMLElement | null;
    expect(slider).toBeTruthy();
    act(() => slider!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true })));
    expect(onFixtureLevel).toHaveBeenLastCalledWith('front-1', 50.1);
    act(() => slider!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onFixtureLevel).toHaveBeenLastCalledWith('front-1', 0);
    act(() => root.unmount());
    host.remove();
  });

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

  it('routes BUSK look pads through the temporary layer instead of the base look path', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.append(host);
    const onLook = vi.fn();
    const onBuskLook = vi.fn();
    const root = createRoot(host);
    act(() => root.render(<DesktopLiveController
      {...props}
      showName="Busk Look Test"
      looks={[{ id: 'look-blue', name: 'Blue Look', color: '#286cff' }]}
      onLook={onLook}
      onBuskLook={onBuskLook}
    />));

    const click = (label: string) => {
      const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      expect(button, label).toBeTruthy();
      act(() => button!.click());
    };

    click('BUSK');
    click('Blue Look');
    expect(onBuskLook).toHaveBeenCalledWith('look-blue');
    expect(onLook).not.toHaveBeenCalled();

    act(() => root.unmount());
    host.remove();
  });

  it('routes BUSK intensity through the temporary layer and releases it independently', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.append(host);
    const onSelectedLevel = vi.fn();
    const onBuskSelectedLevel = vi.fn();
    const onBuskRelease = vi.fn();
    const root = createRoot(host);
    act(() => root.render(<DesktopLiveController
      {...props}
      showName="Busk Layer Test"
      buskActive
      onSelectedLevel={onSelectedLevel}
      onBuskSelectedLevel={onBuskSelectedLevel}
      onBuskRelease={onBuskRelease}
    />));

    const click = (label: string) => {
      const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
      expect(button, label).toBeTruthy();
      act(() => button!.click());
    };

    click('BUSK');
    click('FULL');
    expect(onBuskSelectedLevel).toHaveBeenCalledWith(100);
    expect(onSelectedLevel).not.toHaveBeenCalled();
    click('RELEASE BUSK');
    expect(onBuskRelease).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    host.remove();
  });

});
