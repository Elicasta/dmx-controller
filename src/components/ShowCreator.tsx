import ResizableWorkspace from './ResizableWorkspace';
import TempoInput from './TempoInput';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { PatchedFixture } from "../lib/fixtures";
import type { FixtureGroup } from "../lib/show";
import type { CustomEffect } from "../lib/effects";
import {
  createSection,
  FX_RECIPES,
  SHOW_COLORS,
  SONG_TEMPLATES,
  type ShowSection,
  isShowSection,
  type FxRecipe,
} from "../lib/show-design";
type Props = {
  customEffects?: CustomEffect[];
  onSaveSong?: () => void;
  songName?: string;
  onRenameSong?: (name: string) => void;
  presets: ShowSection[];
  onPresetsChange: (presets:ShowSection[]) => void;
  onSongBank?: () => void;
  sections: ShowSection[];
  setSections: Dispatch<SetStateAction<ShowSection[]>>;
  groups: FixtureGroup[];
  fixtures: PatchedFixture[];
  onBuild: () => void;
  onPreview: (section: ShowSection) => void;
  onStop: () => void;
  onTimeline: () => void;
  onEditFx: (effect: CustomEffect) => void;
  tempoLocked: boolean;
  onTempoLockChange: (locked: boolean) => void;
  masterBpm: number;
  onMasterBpmChange: (bpm: number) => void;
};
export default function ShowCreator({
  customEffects = [], onSaveSong,
  songName,
  onRenameSong,
  presets, onPresetsChange,
  onSongBank,
  sections,
  setSections,
  groups,
  fixtures,
  onBuild,
  onPreview,
  onStop,
  onTimeline,
  onEditFx,
  masterBpm,
  onMasterBpmChange,
  tempoLocked, onTempoLockChange,
}: Props) {
  const recipes: FxRecipe[] = useMemo(() => [...FX_RECIPES, ...customEffects.map(effect => ({
    id:'custom:' + effect.id, name:effect.name, category:'Custom' as const, description:'Saved FX from your Programmer library', effect,
  }))], [customEffects]);
  const [copiedSection, setCopiedSection] = useState<ShowSection | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const parsed=JSON.parse(localStorage.getItem('lumarig.fx-favorites.v1') ?? '[]'); return Array.isArray(parsed) ? parsed.filter(x=>typeof x==='string') : []; } catch { return []; }
  });
  const favorite = (id:string) => setFavorites(all => {
    const next=all.includes(id)?all.filter(x=>x!==id):[...all,id];
    try { localStorage.setItem('lumarig.fx-favorites.v1',JSON.stringify(next)); } catch {}
    return next;
  });
  const [song, setSong] = useState(songName ?? sections[0]?.song ?? "New Song");
  const cloneSection = (source:ShowSection):ShowSection => ({...structuredClone(source),id:crypto.randomUUID(),song,
    layers:source.layers.map(layer=>({...structuredClone(layer),id:crypto.randomUUID()}))});
  const [bpm, setBpm] = useState(sections[0]?.bpm ?? masterBpm);
  const [groupId, setGroupId] = useState(
    sections[0]?.groupId ?? groups[0]?.id ?? "",
  );
  const [selectedId, setSelectedId] = useState(sections[0]?.id ?? "");
  const [dragId, setDragId] = useState("");
  const [previewingId, setPreviewingId] = useState("");
  const [query, setQuery] = useState("");
  const [songFilter,setSongFilter]=useState("");
  const [sectionSearch,setSectionSearch]=useState("");
  const [category, setCategory] = useState("All");
  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const songStats = useMemo(() => [...new Set(sections.map((section) => section.song))].map((name) => {
    const items = sections.filter((section) => section.song === name);
    return { name, count: items.length, bars: items.reduce((sum, section) => sum + section.bars, 0) };
  }), [sections]);
  useEffect(() => setBpm(masterBpm), [masterBpm]);
  const setMasterTempo = (value: number) => {
    const next = Math.max(20, Math.min(300, Number.isFinite(value) ? value : 120));
    setBpm(next);
    onMasterBpmChange(next);
  };
  const preview = (section: ShowSection) => {
    setSelectedId(section.id);
    setPreviewingId(section.id);
    onPreview(section);
  };
  const stopPreview = () => {
    setPreviewingId("");
    onStop();
  };
  const update = (changes: Partial<ShowSection>) => {
    if (selected)
      setSections((all) =>
        all.map((s) => (s.id === selected.id ? { ...s, ...changes } : s)),
      );
  };
  const add = (section: ShowSection) => {
    setSections((all) => (all.length < 200 ? [...all, section] : all));
    setSelectedId(section.id);
  };
  const targetOptions = (
    <>
      <option value="">All patched fixtures</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} · {g.fixtureOrder.length} fixtures
        </option>
      ))}
    </>
  );
  const move = (from: string, to: string) =>
    setSections((all) => {
      const next = [...all];
      const i = next.findIndex((s) => s.id === from),
        j = next.findIndex((s) => s.id === to);
      if (i < 0 || j < 0) return all;
      next.splice(j, 0, next.splice(i, 1)[0]);
      return next;
    });
  const addLayer = (id: string) => {
    if (!selected) {
      add({
        ...createSection("New Section", song, groupId, bpm),
        recipeId: id,
      });
      return;
    }
    if (selected.layers.length >= 8) return;
    const recipe = recipes.find(r=>r.id===id);
    update({
      layers: [
        ...selected.layers,
        {
          id: crypto.randomUUID(),
          recipeId: id,
          customEffect: id.startsWith("custom:") ? structuredClone(recipe?.effect) : undefined,
          groupId: selected.groupId,
          energy: 70,
          enabled: true,
        },
      ],
    });
  };
  const layerChange = (
    id: string,
    changes: Partial<ShowSection["layers"][number]>,
  ) =>
    update({
      layers: selected.layers.map((l) =>
        l.id === id ? { ...l, ...changes } : l,
      ),
    });
  const reorderLayer = (index:number, delta:number) => {
    if(!selected || index+delta<0 || index+delta>=selected.layers.length)return;
    const layers=[...selected.layers]; [layers[index],layers[index+delta]]=[layers[index+delta],layers[index]]; update({layers});
  };
  return (
    <div className="show-creator">
      <header className="creator-command">
        <div>
          <span>SHOW CREATOR</span>
          <h2>Build the song. Shape the light.</h2>
          <p>
            Start with sections, then stack colors, rhythm and motion. Arrange
            your show in bars.
          </p>
        </div>
        <div className="creator-actions">
          <button onClick={onSongBank}>Song Bank</button><button disabled={!sections.length || !onSaveSong} onClick={onSaveSong}>Save to Song Library</button><button onClick={onTimeline}>Open Timeline ↗</button>
          <button
            className="console-primary"
            disabled={!sections.length || !fixtures.length}
            onClick={onBuild}
          >
            Build / Update {sections.length} Sections
          </button>
        </div>
      </header>
      <ResizableWorkspace className="creator-columns" storageKey="lumarig.creator-columns.v1" compactMode="stack" leftEnabled={false} rightEnabled rightLabel="FX Library" rightDefault={310} centerMinimum={480}>
        <main className="creator-main">
          <section className="creator-card">
            <header>
              <span>YOUR SONG</span>
              <small>{fixtures.length} patched fixtures</small>
            </header>
            <button className="tempo-lock" aria-pressed={tempoLocked} onClick={() => onTempoLockChange(!tempoLocked)}>{tempoLocked ? "Tempo Locked" : "Lock Tempo"}</button>
            <div className="creator-fields">
              <label>
                Song name
                <input aria-label="Creator song name" value={song} onChange={(e) => setSong(e.target.value)} onBlur={() => onRenameSong?.(song)} />
              </label>
              <label>
                Master tempo
                <TempoInput label="Master tempo" value={bpm} onChange={setMasterTempo} />
              </label>
              <label>
                Starting target
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  {targetOptions}
                </select>
              </label>
            </div>
            <div className="creator-master-row"><span>{bpm} BPM drives new sections, timeline playback and live FX.</span><button disabled={!sections.length} onClick={() => setSections((all) => all.map((section) => ({ ...section, bpm })))}>Apply master tempo to all sections</button></div>
            <div className="creator-templates">
              {SONG_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  disabled={sections.length + t.sections.length > 200}
                  onClick={() => {
                    const next = t.sections.map((n) =>
                      createSection(n, song, groupId, bpm),
                    );
                    setSections((all) => [...all, ...next]);
                    setSelectedId(next[0].id);
                  }}
                >
                  <strong>{t.name}</strong>
                  <span>{t.description}</span>
                  <small>＋ {t.sections.length} sections</small>
                </button>
              ))}
            </div>
          </section>
          <section className="creator-card">
            <header>
              <span>SONG SECTIONS</span>
              <button
                disabled={sections.length >= 200}
                onClick={() =>
                  add(createSection("New Section", song, groupId, bpm))
                }
              >
                ＋ Section
              </button>
            </header>
            <p className="creator-hint">
              Drag to reorder. Each section becomes a reusable cue and a
              timeline clip.
            </p>
            <div className="creator-song-strip"><button className={!songFilter ? "active" : ""} onClick={() => setSongFilter("")}><strong>ALL SONGS</strong><small>{sections.length} sections</small></button>{songStats.map((item) => <button key={item.name} className={songFilter === item.name ? "active" : ""} onClick={() => { setSongFilter(item.name); setSong(item.name); const first = sections.find((section) => section.song === item.name); if (first) setGroupId(first.groupId); }}><strong>{item.name}</strong><small>{item.count} sections · {item.bars} bars</small></button>)}</div>
            <div className="creator-song-filter"><select aria-label="Filter sections by song" value={songFilter} onChange={e=>setSongFilter(e.target.value)}><option value="">All songs</option>{songStats.map(item=><option key={item.name}>{item.name}</option>)}</select><input aria-label="Find section" placeholder="Find a section…" value={sectionSearch} onChange={e=>setSectionSearch(e.target.value)}/></div>
            <div className="section-list">
              {sections.length ? (
                sections.map((s, index) => (!songFilter||s.song===songFilter) && (s.name+" "+s.song).toLowerCase().includes(sectionSearch.toLowerCase()) && (
                  <article
                    key={s.id}
                    draggable
                    onDragStart={e => {setDragId(s.id);e.dataTransfer.setData("application/lumarig-section",s.id);}}
                    onDragEnd={() => setDragId("")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const recipeId=e.dataTransfer.getData("application/lumarig-fx");
                      if(recipes.some(r=>r.id===recipeId)) {
                        setSections(all=>all.map(item=>item.id!==s.id||item.layers.length>=8?item:{...item,layers:[...item.layers,{id:crypto.randomUUID(),recipeId,customEffect:recipeId.startsWith("custom:")?structuredClone(recipes.find(r=>r.id===recipeId)?.effect):undefined,groupId:item.groupId,energy:70,enabled:true}]}));
                      } else move(dragId, s.id);
                      setDragId("");
                    }}
                    className={selected?.id === s.id ? "active" : ""}
                    style={
                      {
                        "--section-color": s.color,
                      } as import("react").CSSProperties
                    }
                  >
                    <button
                      className="section-select"
                      onClick={() => setSelectedId(s.id)}
                    >
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      <div>
                        <strong>{s.name}</strong>
                        <small>
                          {s.song} · {s.bars} bars ·{" "}
                          {s.layers.filter((l) => l.enabled).length +
                            Number(Boolean(s.recipeId))}{" "}
                          FX layers
                        </small>
                      </div>
                      <i />
                    </button>
                    <div className="section-buttons">
                      <button
                        className={previewingId === s.id ? "section-preview active" : "section-preview"}
                        aria-label={`Preview ${s.name}`}
                        title={previewingId === s.id ? "Previewing" : "Preview section"}
                        onClick={() => previewingId === s.id ? stopPreview() : preview(s)}
                      >
                        {previewingId === s.id ? "■" : "▶"}
                      </button>
                      <button
                        aria-label={`Move ${s.name} up`}
                        disabled={index === 0}
                        onClick={() => move(s.id, sections[index - 1].id)}
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Move ${s.name} down`}
                        disabled={index === sections.length - 1}
                        onClick={() => move(s.id, sections[index + 1].id)}
                      >
                        ↓
                      </button>
                      <button
                        disabled={sections.length >= 200}
                        onClick={() =>
                          add({
                            ...structuredClone(s),
                            id: crypto.randomUUID(),
                            name: `${s.name} Copy`,
                            layers: s.layers.map((l) => ({
                              ...l,
                              id: crypto.randomUUID(),
                            })),
                          })
                        }
                      >
                        Copy
                      </button>
                      <button
                        aria-label={`Delete ${s.name}`}
                        onClick={() =>
                          setSections((all) =>
                            all.filter((item) => item.id !== s.id),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="creator-empty">
                  Choose a song template or add a section to start.
                </div>
              )}
            </div>
          </section>
          {selected && (
            <section className="creator-card section-editor" onDragOver={e=>{if(e.dataTransfer.types.includes("application/lumarig-fx"))e.preventDefault();}} onDrop={e=>{const id=e.dataTransfer.getData("application/lumarig-fx");if(recipes.some(r=>r.id===id)){e.preventDefault();addLayer(id);}}}>
              <header className="section-editor-header">
                <span>SECTION DESIGN</span>
                <strong>{selected.name}</strong>
                <div className="section-preview-controls">
                  <button className={previewingId === selected.id ? "console-primary active" : "console-primary"} onClick={() => preview(selected)}>▶ Preview</button>
                  <button disabled={!previewingId} onClick={stopPreview}>■ Stop</button>
                </div>
              </header>
              <button className="tempo-lock" aria-pressed={tempoLocked} onClick={() => onTempoLockChange(!tempoLocked)}>{tempoLocked ? "Tempo Locked" : "Lock Tempo"}</button>
            <div className="creator-fields">
                <label>
                  Section name
                  <input
                    value={selected.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label>
                  Song
                  <input
                    value={selected.song}
                    onChange={(e) => update({ song: e.target.value })}
                  />
                </label>
                <label>
                  Target
                  <select
                    value={selected.groupId}
                    onChange={(e) => update({ groupId: e.target.value })}
                  >
                    {targetOptions}
                  </select>
                </label>
                <label>
                  Bars
                  <input
                    type="number"
                    min={0.25}
                    max={512}
                    step={1}
                    value={selected.bars}
                    onChange={(e) =>
                      update({
                        bars: Math.max(
                          0.25,
                          Math.min(512, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Section tempo
                  <input
                    type="number"
                    min={20}
                    max={300}
                    value={selected.bpm}
                    onChange={(e) =>
                      update({
                        bpm: Math.max(
                          20,
                          Math.min(300, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Fade ms
                  <input
                    type="number"
                    min={0}
                    max={60000}
                    step={100}
                    value={selected.fadeMs}
                    onChange={(e) =>
                      update({
                        fadeMs: Math.max(
                          0,
                          Math.min(60000, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <label className="section-notes">Notes<textarea aria-label="Section notes" maxLength={4000} value={selected.notes ?? ''} onChange={e=>update({notes:e.target.value})} placeholder="Programming or performance notes" /></label>
              <div className="section-colors">
                {SHOW_COLORS.map((c) => (
                  <button
                    key={c.name}
                    title={c.name}
                    aria-label={c.name}
                    className={selected.color === c.hex ? "active" : ""}
                    style={{ background: c.hex }}
                    onClick={() => update({ color: c.hex })}
                  />
                ))}
                <input
                  aria-label="Section color"
                  type="color"
                  value={selected.color}
                  onChange={(e) => update({ color: e.target.value })}
                />
              </div>
              <button className="tempo-lock" aria-pressed={tempoLocked} onClick={() => onTempoLockChange(!tempoLocked)}>{tempoLocked ? "Tempo Locked" : "Lock Tempo"}</button>
            <div className="creator-fields">
                <label>
                  Intensity · {selected.intensity}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selected.intensity}
                    onChange={(e) =>
                      update({ intensity: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  FX energy · {selected.energy}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selected.energy}
                    onChange={(e) => update({ energy: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Primary FX
                  <select
                    aria-label="Primary FX"
                value={selected.recipeId}
                    onChange={(e) => update({ recipeId: e.target.value })}
                  >
                    <option value="">Static look</option>
                    {FX_RECIPES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <header>
                <span>STACKED FX</span>
                <small>
                  {selected.layers.length} / 8 · last layer wins shared
                  attributes
                </small>
              </header>
              <div className="section-stack">
                {selected.layers.map((l, index) => (
                  <div key={l.id} className="section-layer">
                    <input
                      aria-label={`Enable layer ${index + 1}`}
                      type="checkbox"
                      checked={l.enabled}
                      onChange={(e) =>
                        layerChange(l.id, { enabled: e.target.checked })
                      }
                    />
                    <select
                      aria-label={`Layer ${index + 1} FX`}
                      value={l.recipeId}
                      onChange={(e) =>
                        layerChange(l.id, { recipeId: e.target.value, customEffect: e.target.value.startsWith('custom:') ? structuredClone(recipes.find(r=>r.id===e.target.value)?.effect) : undefined })
                      }
                    >
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Layer ${index + 1} target`}
                      value={l.groupId}
                      onChange={(e) =>
                        layerChange(l.id, { groupId: e.target.value })
                      }
                    >
                      {targetOptions}
                    </select>
                    <label>
                      Energy
                      <input
                        aria-label={`Layer ${index + 1} energy`}
                        type="range"
                        min={0}
                        max={100}
                        value={l.energy}
                        onChange={(e) =>
                          layerChange(l.id, { energy: Number(e.target.value) })
                        }
                      />
                    </label>
                    <button
                      aria-label={`Remove layer ${index + 1}`}
                      onClick={() =>
                        update({
                          layers: selected.layers.filter(
                            (item) => item.id !== l.id,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                    <div className="layer-controls">
                      <label>Intensity %<input aria-label={`Layer ${index+1} intensity`} type="number" min={0} max={100} value={l.intensity ?? selected.intensity} onChange={e=>layerChange(l.id,{intensity:Math.max(0,Math.min(100,Number(e.target.value)))})} /></label>
                      <label>Color<input aria-label={`Layer ${index+1} color`} type="color" value={l.color ?? selected.color} onChange={e=>layerChange(l.id,{color:e.target.value})} /></label>
                      <label>Cycle<select aria-label={`Layer ${index+1} musical cycle`} value={l.cycleBeats ?? ''} onChange={e=>layerChange(l.id,{cycleBeats:e.target.value ? Number(e.target.value):undefined})}>
                        <option value="">Recipe default</option>{[[16,'4 Bars'],[8,'2 Bars'],[4,'1 Bar'],[2,'½ Bar'],[1,'1 Beat'],[0.5,'½ Beat'],[0.25,'¼ Beat'],[0.125,'⅛ Beat'],[0.0625,'1/16 Beat'],[1/3,'Beat Triplet']].map(([value,label])=><option key={value} value={value}>{label}</option>)}
                      </select></label>
                      <label>Rate<select aria-label={`Layer ${index+1} rate`} value={l.rateMultiplier ?? 1} onChange={e=>layerChange(l.id,{rateMultiplier:Number(e.target.value)})}>{[0.25,0.5,1,2,3,4,8].map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select></label>
                      <label>Phase (beats)<input aria-label={`Layer ${index+1} phase`} type="number" min={-32} max={32} step={0.25} value={l.phaseOffsetBeats ?? 0} onChange={e=>layerChange(l.id,{phaseOffsetBeats:Math.max(-32,Math.min(32,Number(e.target.value)))})} /></label>
                      <label>Phase spread %<input aria-label={`Layer ${index+1} phase spread`} type="number" min={0} max={200} value={l.phaseSpread ?? recipes.find(r=>r.id===l.recipeId)?.effect.phaseSpread ?? 0} onChange={e=>layerChange(l.id,{phaseSpread:Math.max(0,Math.min(200,Number(e.target.value)))})} /></label>
                      <label>Direction<select aria-label={`Layer ${index+1} direction`} value={l.direction ?? 'forward'} onChange={e=>layerChange(l.id,{direction:e.target.value as 'forward'|'reverse'})}><option value="forward">Forward</option><option value="reverse">Reverse</option></select></label>
                      <label>Offset %<input aria-label={`Layer ${index+1} offset`} type="number" min={-100} max={100} value={l.offset ?? recipes.find(r=>r.id===l.recipeId)?.effect.offset ?? 0} onChange={e=>layerChange(l.id,{offset:Math.max(-100,Math.min(100,Number(e.target.value)))})} /></label>
                      {(recipes.find(r=>r.id===l.recipeId)?.category==='Movement') && <label>Movement<select aria-label={`Layer ${index+1} movement`} value={l.motionShape ?? 'circle'} onChange={e=>layerChange(l.id,{motionShape:e.target.value as CustomEffect['motionShape']})}>{['circle','figure-eight','diagonal','pan-sweep','tilt-sweep'].map(shape=><option key={shape}>{shape}</option>)}</select></label>}
                      <div className="layer-order"><button aria-label={`Move layer ${index+1} up`} disabled={index===0} onClick={()=>reorderLayer(index,-1)}>↑</button><button aria-label={`Move layer ${index+1} down`} disabled={index===selected.layers.length-1} onClick={()=>reorderLayer(index,1)}>↓</button><button onClick={()=>layerChange(l.id,{intensity:undefined,color:undefined,cycleBeats:undefined,rateMultiplier:undefined,phaseOffsetBeats:undefined,phaseSpread:undefined,direction:undefined,offset:undefined,motionShape:undefined})}>Reset Layer</button></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="creator-actions creator-actions-footer">
                <button onClick={()=>add({...cloneSection(selected),name:selected.name+' Copy'})} disabled={sections.length>=200}>Duplicate Section</button>
                <button onClick={()=>{setCopiedSection(structuredClone(selected));void navigator.clipboard?.writeText(JSON.stringify(selected)).catch(()=>{});}}>Copy Section</button>
                <button disabled={sections.length>=200} onClick={async()=>{
                  let source=copiedSection;
                  try { const parsed:unknown=JSON.parse(await navigator.clipboard.readText()); if(isShowSection(parsed))source=parsed; } catch {}
                  if(source)add(cloneSection(source));
                }}>Paste Section</button>
                <button
                  onClick={() => {
                    const next = [
                      { ...structuredClone(selected), id: crypto.randomUUID() },
                      ...presets,
                    ].slice(0, 64);
                    onPresetsChange(next);
                  }}
                >
                  Save Section Preset
                </button>
              </div>
            </section>
          )}
        </main>
        <aside className="creator-library">
          <section className="creator-card">
            <header>
              <span>FX RECIPE LIBRARY</span>
              <small>{recipes.length} recipes</small>
            </header>
            <p className="creator-hint">
              Add recipes to the selected section. Row FX use a group's
              selection grid.
            </p>
            <input
              aria-label="Search FX recipes"
              placeholder="Search waves, rows, colors…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="recipe-filters">
              {["All", "Favorites", "Intensity", "Rows", "Movement", "Color", "Custom"].map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="recipe-list">
              {recipes.filter(
                (r) =>
                  (category === "All" || (category === "Favorites" ? favorites.includes(r.id) : r.category === category)) &&
                  `${r.name} ${r.description}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              ).map((r) => (
                <article key={r.id} draggable onDragStart={e=>{e.dataTransfer.setData("application/lumarig-fx",r.id);e.dataTransfer.effectAllowed="copy";}}>
                  <div>
                    <small>{r.category.toUpperCase()}</small>
                    <strong>{r.name}</strong>
                    <p>{r.description}</p>
                  </div>
                  <div>
                    <button aria-label={`Favorite ${r.name}`} aria-pressed={favorites.includes(r.id)} onClick={()=>favorite(r.id)}>{favorites.includes(r.id)?'★':'☆'}</button>
                    <button
                      disabled={Boolean(
                        selected && selected.layers.length >= 8,
                      )}
                      onClick={() => addLayer(r.id)}
                    >
                      ＋ Layer
                    </button>
                    <button
                      onClick={() =>
                        onEditFx({
                          ...structuredClone(r.effect),
                          id: crypto.randomUUID(),
                        })
                      }
                    >
                      Edit FX ↗
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="creator-card">
            <header>
              <span>YOUR SECTION PRESETS</span>
              <small>{presets.length}</small>
            </header>
            {presets.length ? (
              presets.map((p) => (
                <div key={p.id} className="saved-section">
                  <button
                    disabled={sections.length >= 200}
                    onClick={() =>
                      add({
                        ...structuredClone(p),
                        id: crypto.randomUUID(),
                        song,
                        groupId,
                        layers: p.layers.map((l) => ({
                          ...l,
                          id: crypto.randomUUID(),
                        })),
                      })
                    }
                  >
                    {p.name}
                    <small>
                      {p.layers.length + Number(Boolean(p.recipeId))} FX layers
                    </small>
                  </button>
                  <button
                    aria-label={`Delete preset ${p.name}`}
                    onClick={() => {
                      const next = presets.filter((x) => x.id !== p.id);
                      onPresetsChange(next);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p>Save a section you like, then reuse it for the next song.</p>
            )}
          </section>
        </aside>
      </ResizableWorkspace>
    </div>
  );
}
