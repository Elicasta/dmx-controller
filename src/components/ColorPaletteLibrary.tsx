import { useMemo, useState, type CSSProperties } from 'react';
import type { ColorPalette } from '../core/color';

const UNFILED = 'Unfiled';

export function groupColorPalettes(palettes: readonly ColorPalette[]) {
  const groups = new Map<string, ColorPalette[]>();
  palettes.forEach((palette) => {
    const folder = palette.folder.trim() || UNFILED;
    groups.set(folder, [...(groups.get(folder) ?? []), palette]);
  });
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNFILED) return 1;
    if (b === UNFILED) return -1;
    return a.localeCompare(b);
  });
}

export function ColorPaletteLibrary({ palettes, color, disabled, onChange, onRecall }: {
  palettes: ColorPalette[];
  color: string;
  disabled: boolean;
  onChange: (palettes: ColorPalette[]) => void;
  onRecall: (color: string) => void;
}) {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [filter, setFilter] = useState('');
  const [activeFolder, setActiveFolder] = useState('All folders');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const folders = useMemo(() => [...new Set(palettes.map((palette) => palette.folder.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [palettes]);
  const visible = palettes.filter((palette) => {
    const matchesSearch = `${palette.name} ${palette.folder}`.toLowerCase().includes(filter.toLowerCase());
    const matchesFolder = activeFolder === 'All folders' || (activeFolder === UNFILED ? !palette.folder.trim() : palette.folder.trim() === activeFolder);
    return matchesSearch && matchesFolder;
  });
  const grouped = groupColorPalettes(visible);
  const update = (id: string, patch: Partial<ColorPalette>) => onChange(palettes.map((palette) => palette.id === id ? { ...palette, ...patch } : palette));
  const move = (id: string, direction: -1 | 1) => {
    const index = palettes.findIndex((palette) => palette.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= palettes.length) return;
    const next = [...palettes];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const remove = (palette: ColorPalette) => {
    if (window.confirm(`Delete color palette “${palette.name}”?`)) onChange(palettes.filter((item) => item.id !== palette.id));
  };

  return <section className="color-library color-folder-library">
    <header><div><strong>SHOW COLOR LIBRARY</strong><small>Saved inside this show and organized into folders.</small></div><b>{palettes.length} COLORS · {folders.length} FOLDERS</b></header>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!name.trim() || disabled || palettes.length >= 256) return;
      onChange([...palettes, { id: crypto.randomUUID(), name: name.trim(), folder: folder.trim(), color }]);
      setName('');
    }}>
      <label><span>PALETTE NAME</span><input aria-label="New color palette name" placeholder="Warm stage wash" maxLength={64} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label><span>FOLDER</span><input aria-label="New color palette folder" placeholder="Washes, songs, specials…" list="color-folder-options" maxLength={64} value={folder} onChange={(event) => setFolder(event.target.value)} /></label>
      <datalist id="color-folder-options">{folders.map((item) => <option value={item} key={item} />)}</datalist>
      <button className="console-primary" disabled={disabled || !name.trim() || palettes.length >= 256}>＋ Store Color</button>
    </form>
    <div className="color-library-toolbar"><input aria-label="Filter color palettes" placeholder="Search colors or folders" value={filter} onChange={(event) => setFilter(event.target.value)} /><nav><button className={activeFolder === 'All folders' ? 'active' : ''} onClick={() => setActiveFolder('All folders')}>ALL</button>{folders.map((item) => <button key={item} className={activeFolder === item ? 'active' : ''} onClick={() => setActiveFolder(item)}>{item}</button>)}{palettes.some((palette) => !palette.folder.trim()) && <button className={activeFolder === UNFILED ? 'active' : ''} onClick={() => setActiveFolder(UNFILED)}>UNFILED</button>}</nav></div>
    <div className="color-folder-stack">{grouped.map(([folderName, items]) => <section className="color-folder" key={folderName}>
      <header><button onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(folderName)) next.delete(folderName); else next.add(folderName); return next; })}><span>{collapsed.has(folderName) ? '▸' : '▾'}</span><strong>{folderName}</strong><small>{items.length} {items.length === 1 ? 'color' : 'colors'}</small></button></header>
      {!collapsed.has(folderName) && <div className="color-folder-grid">{items.map((palette) => <article key={palette.id} style={{ '--palette-color': palette.color } as CSSProperties}>
        <button className="palette-recall" aria-label={`Recall ${palette.name}`} disabled={disabled} onClick={() => onRecall(palette.color)}><i /><span>RECALL</span></button>
        <label><span>NAME</span><input aria-label={`Rename ${palette.name}`} maxLength={64} value={palette.name} onChange={(event) => update(palette.id, { name: event.target.value })} onBlur={() => { if (!palette.name.trim()) update(palette.id, { name: 'Color palette' }); }} /></label>
        <label><span>FOLDER</span><input aria-label={`Folder for ${palette.name}`} list="color-folder-options" maxLength={64} value={palette.folder} placeholder="Unfiled" onChange={(event) => update(palette.id, { folder: event.target.value })} /></label>
        <div><button aria-label={`Move ${palette.name} up`} disabled={palettes.findIndex((item) => item.id === palette.id) === 0} onClick={() => move(palette.id, -1)}>↑</button><button aria-label={`Move ${palette.name} down`} disabled={palettes.findIndex((item) => item.id === palette.id) === palettes.length - 1} onClick={() => move(palette.id, 1)}>↓</button><button disabled={disabled} onClick={() => update(palette.id, { color })}>Update color</button><button className="danger-button" onClick={() => remove(palette)}>Delete</button></div>
      </article>)}</div>}
    </section>)}</div>
    {!visible.length && <p>{palettes.length ? 'No colors match this folder or search.' : 'No show colors stored yet. Choose a color, name it, and store it here.'}</p>}
    {disabled && <p>Select an RGB-capable fixture to apply or store a color.</p>}
  </section>;
}
