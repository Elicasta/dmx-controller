// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { OperatorMenuBar } from './OperatorMenuBar';

describe('operator menu bar', () => {
  it('opens an action, invokes it once, then closes', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const save = vi.fn();
    act(() => root.render(<OperatorMenuBar menus={[{ label: 'File', items: [{ label: 'Save Show', action: save }] }]} />));
    act(() => (host.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement).click());
    expect(host.querySelector('[role="menu"]')).not.toBeNull();
    act(() => (host.querySelector('[role="menu"] button') as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="menu"]')).toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
