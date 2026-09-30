import { useState, type Dispatch, type SetStateAction } from "react";
import type { PatchedFixture } from "../lib/fixtures";
import type { FixtureGroup } from "../lib/show";
import type { CustomEffect } from "../lib/effects";
import {
  createSection,
  FX_RECIPES,
  SHOW_COLORS,
  SONG_TEMPLATES,
  isShowSection,
  type ShowSection,
} from "../lib/show-design";
type Props = {
  sections: ShowSection[];
  setSections: Dispatch<SetStateAction<ShowSection[]>>;
  groups: FixtureGroup[];
  fixtures: PatchedFixture[];
  onBuild: () => void;
  onPreview: (section: ShowSection) => void;
  onStop: () => void;
  onTimeline: () => void;
  onEditFx: (effect: CustomEffect) => void;
};
const PRESETS = "lumarig-section-presets-v1";
function loadPresets() {
  try {
    const v = JSON.parse(localStorage.getItem(PRESETS) ?? "[]");
    return Array.isArray(v) ? v.filter(isShowSection).slice(0, 64) : [];
  } catch {
    return [];
  }
}
export default function ShowCreator({
  sections,
  setSections,
  groups,
  fixtures,
  onBuild,
  onPreview,
  onStop,
  onTimeline,
  onEditFx,
}: Props) {
  const [song, setSong] = useState(sections[0]?.song ?? "New Song");
  const [bpm, setBpm] = useState(sections[0]?.bpm ?? 100);
  const [groupId, setGroupId] = useState(
    sections[0]?.groupId ?? groups[0]?.id ?? "",
  );
  const [selectedId, setSelectedId] = useState(sections[0]?.id ?? "");
  const [dragId, setDragId] = useState("");
  const [query, setQuery] = useState("");
  const [songFilter,setSongFilter]=useState("");
  const [sectionSearch,setSectionSearch]=useState("");
  const [category, setCategory] = useState("All");
  const [presets, setPresets] = useState<ShowSection[]>(loadPresets);
  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
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
    update({
      layers: [
        ...selected.layers,
        {
          id: crypto.randomUUID(),
          recipeId: id,
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
          <button onClick={onTimeline}>Open Timeline ↗</button>
          <button
            className="console-primary"
            disabled={!sections.length || !fixtures.length}
            onClick={onBuild}
          >
            Build / Update {sections.length} Sections
          </button>
        </div>
      </header>
      <div className="creator-columns">
        <main className="creator-main">
          <section className="creator-card">
            <header>
              <span>YOUR SONG</span>
              <small>{fixtures.length} patched fixtures</small>
            </header>
            <div className="creator-fields">
              <label>
                Song name
                <input value={song} onChange={(e) => setSong(e.target.value)} />
              </label>
              <label>
                Tempo
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={bpm}
                  onChange={(e) =>
                    setBpm(Math.max(20, Math.min(300, Number(e.target.value))))
                  }
                />
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
            <div className="creator-song-filter"><select aria-label="Filter sections by song" value={songFilter} onChange={e=>setSongFilter(e.target.value)}><option value="">All songs</option>{[...new Set(sections.map(s=>s.song))].map(name=><option key={name}>{name}</option>)}</select><input aria-label="Find section" placeholder="Find a section…" value={sectionSearch} onChange={e=>setSectionSearch(e.target.value)}/></div>
            <div className="section-list">
              {sections.length ? (
                sections.map((s, index) => (!songFilter||s.song===songFilter) && (s.name+" "+s.song).toLowerCase().includes(sectionSearch.toLowerCase()) && (
                  <article
                    key={s.id}
                    draggable
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => setDragId("")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const recipeId=e.dataTransfer.getData("application/lumarig-fx");
                      if(FX_RECIPES.some(r=>r.id===recipeId)) {
                        setSections(all=>all.map(item=>item.id!==s.id||item.layers.length>=8?item:{...item,layers:[...item.layers,{id:crypto.randomUUID(),recipeId,groupId:item.groupId,energy:70,enabled:true}]}));
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
            <section className="creator-card section-editor" onDragOver={e=>{if(e.dataTransfer.types.includes("application/lumarig-fx"))e.preventDefault();}} onDrop={e=>{const id=e.dataTransfer.getData("application/lumarig-fx");if(FX_RECIPES.some(r=>r.id===id)){e.preventDefault();addLayer(id);}}}>
              <header>
                <span>SECTION DESIGN</span>
                <strong>{selected.name}</strong>
              </header>
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
                  Tempo
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
                        layerChange(l.id, { recipeId: e.target.value })
                      }
                    >
                      {FX_RECIPES.map((r) => (
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
                  </div>
                ))}
              </div>
              <div className="creator-actions">
                <button
                  className="console-primary"
                  onClick={() => onPreview(selected)}
                >
                  Preview Section
                </button>
                <button onClick={onStop}>Stop Preview</button>
                <button
                  onClick={() => {
                    const next = [
                      { ...structuredClone(selected), id: crypto.randomUUID() },
                      ...presets,
                    ].slice(0, 64);
                    setPresets(next);
                    localStorage.setItem(PRESETS, JSON.stringify(next));
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
              <small>{FX_RECIPES.length} recipes</small>
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
              {["All", "Intensity", "Rows", "Movement", "Color"].map((c) => (
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
              {FX_RECIPES.filter(
                (r) =>
                  (category === "All" || r.category === category) &&
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
                      setPresets(next);
                      localStorage.setItem(PRESETS, JSON.stringify(next));
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
      </div>
    </div>
  );
}
