import { useMemo, useState, type CSSProperties } from 'react';
import type { ShowCue } from '../lib/show';
import type { ShowTimeline } from '../lib/show-design';

type Props = {
  cues: ShowCue[];
  timeline?: ShowTimeline;
  activeCueId: string | null;
  onRunCue: (cue: ShowCue) => void;
  onMoveCue: (cueId: string, direction: -1 | 1) => void;
  onDeleteCue: (cueId: string) => void;
  onCapture: () => void;
  onOpenCreate: () => void;
  onOpenTimeline: () => void;
};

type CueItem = {
  id: string;
  name: string;
  type: NonNullable<ShowCue['itemType']>;
  cues: ShowCue[];
  timelineCount: number;
};

type CueSection = {
  id: string;
  name: string;
  items: CueItem[];
  cueCount: number;
};

const clean = (value: string | undefined, fallback: string) => value?.trim() || fallback;

export function CueRunNavigator(props: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  const clipCueIds = useMemo(() => new Set((props.timeline?.clips ?? []).filter((clip) => clip.enabled).map((clip) => clip.cueId)), [props.timeline?.clips]);

  const sections = useMemo<CueSection[]>(() => {
    const sectionOrder: string[] = [];
    const sectionMap = new Map<string, Map<string, CueItem>>();

    props.cues.forEach((cue) => {
      const sectionName = clean(cue.runSection, 'Service');
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, new Map());
        sectionOrder.push(sectionName);
      }
      const timelineCue = clipCueIds.has(cue.id);
      const itemName = clean(cue.trackName, timelineCue ? 'Timeline Show' : 'Loose Cues');
      const type = cue.itemType ?? (timelineCue ? 'timeline' : cue.trackName ? 'song' : 'cue');
      const key = `${type}:${itemName}`;
      const items = sectionMap.get(sectionName)!;
      const current = items.get(key) ?? { id: `${sectionName}:${key}`, name: itemName, type, cues: [], timelineCount: 0 };
      current.cues.push(cue);
      if (timelineCue) current.timelineCount += 1;
      items.set(key, current);
    });

    return sectionOrder.map((name) => {
      const items = [...(sectionMap.get(name)?.values() ?? [])];
      return {
        id: name,
        name,
        items,
        cueCount: items.reduce((sum, item) => sum + item.cues.length, 0)
      };
    });
  }, [clipCueIds, props.cues]);

  const toggleSection = (id: string) => setCollapsedSections((current) => ({ ...current, [id]: !current[id] }));
  const toggleItem = (id: string) => setCollapsedItems((current) => ({ ...current, [id]: !current[id] }));

  return <aside className="cue-list-console cue-run-navigator">
    <header>
      <span>RUN OF SHOW</span>
      <div><button onClick={props.onOpenTimeline}>Timeline</button><button onClick={props.onCapture}>＋ Capture</button></div>
    </header>
    <div className="cue-run-scroll">
      {sections.map((section) => {
        const sectionCollapsed = Boolean(collapsedSections[section.id]);
        return <section className="cue-run-section" key={section.id}>
          <button className="cue-run-section-head" onClick={() => toggleSection(section.id)}>
            <span>{sectionCollapsed ? '▸' : '▾'}</span>
            <strong>{section.name}</strong>
            <small>{section.cueCount} cue{section.cueCount === 1 ? '' : 's'} · {section.items.length} item{section.items.length === 1 ? '' : 's'}</small>
          </button>
          {!sectionCollapsed && <div className="cue-run-items">{section.items.map((item) => {
            const itemCollapsed = Boolean(collapsedItems[item.id]);
            const activeInside = item.cues.some((cue) => cue.id === props.activeCueId);
            return <section className={`cue-run-item ${activeInside ? 'active' : ''}`} key={item.id}>
              <button className="cue-run-item-head" onClick={() => toggleItem(item.id)}>
                <span>{itemCollapsed ? '▸' : '▾'}</span>
                <b>{item.type === 'song' ? 'SONG' : item.type === 'media' ? 'MEDIA' : item.timelineCount ? 'TIMELINE' : 'CUES'}</b>
                <strong>{item.name}</strong>
                <small>{item.cues.length} cue{item.cues.length === 1 ? '' : 's'}{item.timelineCount ? ` · ${item.timelineCount} on timeline` : ''}</small>
              </button>
              {!itemCollapsed && <div className="cue-run-cues">{item.cues.map((cue) => {
                const index = props.cues.findIndex((candidate) => candidate.id === cue.id);
                return <article className={props.activeCueId === cue.id ? 'active' : ''} key={cue.id} style={{ '--cue-color': cue.color ?? '#55e98d' } as CSSProperties}>
                  <button className="cue-line" onClick={() => props.onRunCue(cue)}>
                    <b>{String(cue.number).padStart(2, '0')}</b>
                    <i style={{ background: cue.color ?? '#55e98d' }} />
                    <span><strong>{cue.name}</strong><small>{cue.fadeMs ? `${cue.fadeMs / 1000}s fade` : 'Snap'}{cue.followMs ? ` · follow ${cue.followMs / 1000}s` : ''}{clipCueIds.has(cue.id) ? ' · timeline' : ''}</small></span>
                  </button>
                  <div>
                    <button disabled={index === 0} onClick={() => props.onMoveCue(cue.id, -1)}>↑</button>
                    <button disabled={index === props.cues.length - 1} onClick={() => props.onMoveCue(cue.id, 1)}>↓</button>
                    <button onClick={() => props.onDeleteCue(cue.id)}>×</button>
                  </div>
                </article>;
              })}</div>}
            </section>;
          })}</div>}
        </section>;
      })}
      {!props.cues.length && <div className="empty-cues"><strong>No cues yet</strong><span>Build a look in CREATE, then capture it here.</span><button onClick={props.onOpenCreate}>Open CREATE</button></div>}
    </div>
  </aside>;
}
