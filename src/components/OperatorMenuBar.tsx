import { useEffect, useRef, useState } from 'react';

export type OperatorMenu = { label: string; items: Array<{ label: string; action: () => void; disabled?: boolean; separator?: boolean }> };

export function OperatorMenuBar({ menus }: { menus: OperatorMenu[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="operator-menu-bar" role="menubar" aria-label="Application menu" ref={root}>
    {menus.map((menu) => <div className="operator-menu" key={menu.label}>
      <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open === menu.label} onClick={() => setOpen(open === menu.label ? null : menu.label)} onMouseEnter={() => { if (open) setOpen(menu.label); }}>{menu.label}</button>
      {open === menu.label && <div className="operator-menu-popover" role="menu" aria-label={menu.label}>
        {menu.items.map((item, index) => <button type="button" role="menuitem" key={`${item.label}-${index}`} className={item.separator ? 'menu-separator' : ''} disabled={item.disabled} onClick={() => { setOpen(null); item.action(); }}>{item.label}</button>)}
      </div>}
    </div>)}
  </div>;
}
