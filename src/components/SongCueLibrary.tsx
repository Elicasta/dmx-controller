import { useMemo, useState } from 'react';
import type { ShowCue, ShowFile, ShowRundownSection } from '../lib/show';
import { isShowFile } from '../lib/show';

type Props = {
  cues: ShowCue[];
  sections: ShowRundownSection[];
  activeId: string | null;
  timelineNames: string[];
  onRun: (cue: ShowCue) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onMoveSong: (sectionId: string, name: string, direction: -1 | 1) => void;
  onSectionsChange: (sections: ShowRundownSection[]) => void;
  onCapture: () => void;
  onTimeline: (song: string) => void;
  onImport: (show: ShowFile) => void;
};

const cueItemName = (cue: ShowCue) => cue.trackName?.trim() || 'Unfiled cues';
const cueItemKind = (cue: ShowCue) => cue.trackKind === 'media' ? 'media' : 'song';

export default function SongCueLibrary(p: Props) {
  const [query, setQuery] = useState('');
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});
  const [closedItems, setClosedItems] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  const knownSectionIds = useMemo(() => new Set(p.sections.map((section) => section.id)), [p.sections]);
  const sectionIdForCue = (cue: ShowCue) =>
    cue.rundownSectionId && knownSectionIds.has(cue.rundownSectionId) ? cue.rundownSectionId : '';

  const hasUnfiled = p.cues.some((cue) => sectionIdForCue(cue) === '');
  const sectionViews = [
    ...p.sections.map((section) => ({ ...section, synthetic: false })),
    ...((hasUnfiled || !p.sections.length)
      ? [{ id: '', name: p.sections.length ? 'Unfiled' : 'Show', synthetic: true }]
      : []),
  ];

  const matches = (cue: ShowCue) =>
    `${cue.name} ${cueItemName(cue)} ${cueItemKind(cue)}`.toLowerCase().includes(query.toLowerCase());

  const addSection = () => {
    const section = {
      id: crypto.randomUUID(),
      name: `Section ${p.sections.length + 1}`,
    };
    p.onSectionsChange([...p.sections, section]);
    setClosedSections((current) => ({ ...current, [section.id]: false }));
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    const from = p.sections.findIndex((section) => section.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= p.sections.length) return;
    const next = [...p.sections];
    [next[from], next[to]] = [next[to], next[from]];
    p.onSectionsChange(next);
  };

  const renameSection = (id: string, name: string) =>
    p.onSectionsChange(p.sections.map((section) => section.id === id ? { ...section, name } : section));

  return <aside className="cue-list-console song-cue-library">
    <header className="rundown-library-head">
      <span>SHOW RUNDOWN</span>
      <div>
        <button onClick={addSection}>＋ Section</button>
        <button onClick={p.onCapture}>＋ Capture</button>
      </div>
    </header>

    <input
      aria-label="Search songs and cues"
      placeholder="Find a section, song, media item or cue…"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
    />

    <label className="file-button">
      Import timeline show
      <input
        aria-label="Import timeline show"
        type="file"
        accept=".json,application/json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            const value = JSON.parse(await file.text());
            if (!isShowFile(value)) throw Error('Choose an exported LumaRig show JSON file.');
            p.onImport(value);
            setError('');
          } catch (err) {
            setError(String(err));
          }
        }}
      />
    </label>
    {error && <p role="alert">{error}</p>}

    <div className="rundown-section-list">
      {sectionViews.map((section, sectionIndex) => {
        const sectionCues = p.cues.filter((cue) => sectionIdForCue(cue) === section.id && matches(cue));
        const itemMap = new Map<string, { name: string; kind: 'song' | 'media'; cues: ShowCue[] }>();
        for (const cue of sectionCues) {
          const name = cueItemName(cue);
          const kind = cueItemKind(cue);
          const key = `${kind}:${name}`;
          const item = itemMap.get(key) ?? { name, kind, cues: [] };
          item.cues.push(cue);
          itemMap.set(key, item);
        }
        const items = [...itemMap.values()];
        if (query && !items.length && !section.name.toLowerCase().includes(query.toLowerCase())) return null;
        const sectionExpanded = Boolean(query) || !(closedSections[section.id] ?? false);
        const realSectionIndex = p.sections.findIndex((item) => item.id === section.id);

        return <section className="show-rundown-section" key={section.id || '__unfiled'}>
          <header className="show-rundown-section-head">
            <button
              className="rundown-section-toggle"
              aria-expanded={sectionExpanded}
              onClick={() => setClosedSections((current) => ({ ...current, [section.id]: sectionExpanded }))}
            >
              <strong>{sectionExpanded ? '▾' : '▸'} {section.name}</strong>
              <small>{items.length} item{items.length === 1 ? '' : 's'} · {sectionCues.length} cue{sectionCues.length === 1 ? '' : 's'}</small>
            </button>
            {!section.synthetic && <div className="rundown-section-actions">
              <input
                aria-label={`Section name ${sectionIndex + 1}`}
                value={section.name}
                onChange={(event) => renameSection(section.id, event.target.value)}
              />
              <button aria-label={`Move section ${section.name} up`} disabled={realSectionIndex <= 0} onClick={() => moveSection(section.id, -1)}>↑</button>
              <button aria-label={`Move section ${section.name} down`} disabled={realSectionIndex < 0 || realSectionIndex >= p.sections.length - 1} onClick={() => moveSection(section.id, 1)}>↓</button>
              <button
                aria-label={`Delete section ${section.name}`}
                onClick={() => p.onSectionsChange(p.sections.filter((item) => item.id !== section.id))}
              >×</button>
            </div>}
          </header>

          {sectionExpanded && <div className="rundown-items">
            {items.map((item, itemIndex) => {
              const itemKey = `${section.id}:${item.kind}:${item.name}`;
              const expanded = Boolean(query) || !(closedItems[itemKey] ?? (items.length > 1));
              return <section className={`song-cue-group rundown-item ${item.kind}`} key={itemKey}>
                <header>
                  <button
                    className="song-toggle"
                    aria-expanded={expanded}
                    onClick={() => setClosedItems((current) => ({ ...current, [itemKey]: expanded }))}
                  >
                    <b className="rundown-kind">{item.kind.toUpperCase()}</b>
                    <span>
                      <strong>{expanded ? '▾' : '▸'} {item.name}</strong>
                      <small>{item.cues.length} cues{p.timelineNames.includes(item.name) ? ' · timeline show' : ''}</small>
                    </span>
                  </button>
                  <div className="rundown-item-header-actions">
                    {(item.kind === 'song' || p.timelineNames.includes(item.name)) && (
                      <button
                        className="rundown-timeline-button"
                        aria-label={`Open timeline for ${item.name}`}
                        title={`Open timeline for ${item.name}`}
                        onClick={() => p.onTimeline(item.name)}
                      >
                        Timeline
                      </button>
                    )}
                    <details className="cue-context-menu rundown-item-menu">
                      <summary aria-label={`Actions for ${item.name}`} title={`Actions for ${item.name}`}>•••</summary>
                      <div>
                        <button disabled={itemIndex === 0} onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onMoveSong(section.id, item.name, -1); }}>Move item up</button>
                        <button disabled={itemIndex === items.length - 1} onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onMoveSong(section.id, item.name, 1); }}>Move item down</button>
                        {(item.kind === 'song' || p.timelineNames.includes(item.name)) && <button onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onTimeline(item.name); }}>Open Timeline</button>}
                      </div>
                    </details>
                  </div>
                </header>

                {expanded && item.cues.map((cue) => <article key={cue.id} className={p.activeId === cue.id ? 'active' : ''}>
                  <button className="cue-line" onClick={() => p.onRun(cue)}>
                    <b>{cue.number}</b>
                    <i style={{ background: cue.color || '#55e98d' }} />
                    <span>
                      <strong>{cue.name}</strong>
                      <small>{cue.fadeMs / 1000}s fade · {cue.effectStack?.length || 0} FX</small>
                    </span>
                  </button>
                  <details className="cue-context-menu">
                    <summary aria-label={`Actions for cue ${cue.name}`} title={`Actions for ${cue.name}`}>•••</summary>
                    <div>
                      <button onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onRun(cue); }}>Run cue</button>
                      <button onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onMove(cue.id, -1); }}>Move up</button>
                      <button onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onMove(cue.id, 1); }}>Move down</button>
                      {(cue.trackKind !== 'media' || p.timelineNames.includes(cueItemName(cue))) && <button onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onTimeline(cueItemName(cue)); }}>Open Timeline</button>}
                      <button className="danger-menu-item" onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement).open=false; p.onDelete(cue.id); }}>Delete cue</button>
                    </div>
                  </details>
                </article>)}
              </section>;
            })}
            {!items.length && <p className="rundown-empty">No cues in this section yet. Capture a cue, then assign it here in Cue Inspector.</p>}
          </div>}
        </section>;
      })}
    </div>

    {!p.cues.length && <p>Build a song in Show Creator or capture your first cue.</p>}
  </aside>;
}
