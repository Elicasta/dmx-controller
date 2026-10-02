import { useEffect, useMemo, useState } from 'react';
import {
  createMediaFolder,
  deleteMediaFolder,
  moveMediaAsset,
  nativeMediaLibraryAvailable,
  pickMediaAssets,
  readMediaLibrary,
  relinkMediaAsset,
  removeMediaAsset,
  renameMediaFolder,
  type MediaAsset,
  type MediaLibrarySnapshot,
} from '../lib/media-library';

type Props = {
  activeSong?: { id: string; name: string } | null;
  mediaUseCounts: Record<string, number>;
  onAttachToActiveSong: (asset: MediaAsset) => Promise<void> | void;
  onAssetChanged: (asset: MediaAsset) => void;
  onExportBackup: () => Promise<void>;
  onRestoreBackup: () => Promise<void>;
};

const EMPTY: MediaLibrarySnapshot = { version: 1, folders: [], assets: [] };

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function folderDepth(id: string, library: MediaLibrarySnapshot) {
  let depth = 0;
  let current = library.folders.find((folder) => folder.id === id);
  const seen = new Set<string>();
  while (current?.parentId && depth < 8 && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = library.folders.find((folder) => folder.id === current?.parentId);
  }
  return depth;
}

export default function MediaLibraryPanel(p: Props) {
  const native = nativeMediaLibraryAvailable();
  const [library, setLibrary] = useState<MediaLibrarySnapshot>(EMPTY);
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const [folderName, setFolderName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [restoreArmed, setRestoreArmed] = useState(false);

  const refresh = async () => {
    if (!native) return;
    setLibrary(await readMediaLibrary());
  };

  useEffect(() => {
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [native]);

  const selectedFolder = library.folders.find((folder) => folder.id === view) ?? null;
  const destinationFolder = selectedFolder?.id ?? null;
  const assets = useMemo(() => library.assets
    .filter((asset) => {
      if (view === 'missing') return asset.missing;
      if (view === 'root') return asset.folderId === null;
      if (view !== 'all') return asset.folderId === view;
      return true;
    })
    .filter((asset) => `${asset.name} ${asset.path} ${asset.kind} ${asset.sourceMode}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b.missing) - Number(a.missing) || a.name.localeCompare(b.name)), [library.assets, query, view]);

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError('');
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy('');
    }
  }

  if (!native) {
    return <div className="media-library-shell">
      <section className="media-library-unavailable">
        <span>LOCAL MEDIA LIBRARY</span>
        <h2>Open this in the installed LumaRig app.</h2>
        <p>The browser preview cannot hold durable file references. The macOS and Windows desktop builds use the native media registry.</p>
      </section>
    </div>;
  }

  return <div className="media-library-shell">
    <header className="media-library-command">
      <div>
        <span>LOCAL MEDIA LIBRARY</span>
        <h2>Files that survive the WebView.</h2>
        <p>Copy media into LumaRig or reference files in place. Missing references stay visible until you relink them.</p>
      </div>
      <div className="media-library-backup-actions">
        <button disabled={!!busy} onClick={() => void run('backup-export', p.onExportBackup)}>
          {busy === 'backup-export' ? 'Building backup…' : 'Export Portable Backup'}
        </button>
        {!restoreArmed
          ? <button className="danger-outline" disabled={!!busy} onClick={() => setRestoreArmed(true)}>Restore Backup…</button>
          : <><button className="danger-button" disabled={!!busy} onClick={() => void run('backup-restore', async () => {
            await p.onRestoreBackup();
            setRestoreArmed(false);
          })}>{busy === 'backup-restore' ? 'Restoring…' : 'Confirm Restore Backup'}</button>
          <button disabled={!!busy} onClick={() => setRestoreArmed(false)}>Cancel</button></>}
      </div>
    </header>

    {error && <p className="media-library-error" role="alert">{error}</p>}

    <div className="media-library-layout">
      <aside className="media-folder-sidebar">
        <div className="media-folder-views">
          <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}><span>All Media</span><b>{library.assets.length}</b></button>
          <button className={view === 'missing' ? 'active warning' : ''} onClick={() => setView('missing')}><span>Missing</span><b>{library.assets.filter((asset) => asset.missing).length}</b></button>
          <button className={view === 'root' ? 'active' : ''} onClick={() => setView('root')}><span>Library Root</span><b>{library.assets.filter((asset) => asset.folderId === null).length}</b></button>
        </div>

        <div className="media-folder-tree">
          {library.folders
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((folder) => <button key={folder.id} className={view === folder.id ? 'active' : ''} style={{ paddingLeft: 14 + folderDepth(folder.id, library) * 14 }} onClick={() => {
              setView(folder.id);
              setRenameName(folder.name);
            }}>
              <span>{folder.name}</span>
              <b>{library.assets.filter((asset) => asset.folderId === folder.id).length}</b>
            </button>)}
        </div>

        <form className="media-folder-create" onSubmit={(event) => {
          event.preventDefault();
          if (!folderName.trim()) return;
          void run('new-folder', async () => {
            const folder = await createMediaFolder(folderName, selectedFolder?.id ?? null);
            setFolderName('');
            setView(folder.id);
            setRenameName(folder.name);
          });
        }}>
          <input aria-label="New media folder" value={folderName} placeholder={selectedFolder ? `New folder in ${selectedFolder.name}` : 'New folder'} onChange={(event) => setFolderName(event.target.value)} />
          <button disabled={!folderName.trim() || !!busy}>Create</button>
        </form>

        {selectedFolder && <div className="media-folder-edit">
          <input aria-label="Rename media folder" value={renameName} onChange={(event) => setRenameName(event.target.value)} />
          <button disabled={!renameName.trim() || renameName === selectedFolder.name || !!busy} onClick={() => void run('rename-folder', async () => {
            await renameMediaFolder(selectedFolder.id, renameName);
          })}>Rename</button>
          <button className="danger-outline" disabled={!!busy} onClick={() => void run('delete-folder', async () => {
            await deleteMediaFolder(selectedFolder.id);
            setView('root');
            setRenameName('');
          })}>Delete Empty Folder</button>
        </div>}
      </aside>

      <main className="media-library-main">
        <div className="media-library-toolbar">
          <input aria-label="Search media library" value={query} placeholder="Search media…" onChange={(event) => setQuery(event.target.value)} />
          <button className="console-primary" disabled={!!busy} onClick={() => void run('import-copy', async () => {
            await pickMediaAssets('copy', destinationFolder);
          })}>{busy === 'import-copy' ? 'Importing…' : 'Import Copy'}</button>
          <button disabled={!!busy} onClick={() => void run('import-reference', async () => {
            await pickMediaAssets('reference', destinationFolder);
          })}>{busy === 'import-reference' ? 'Linking…' : 'Reference In Place'}</button>
          <button disabled={!!busy} onClick={() => void refresh()}>Refresh</button>
        </div>

        <div className="media-library-summary">
          <span><small>VIEW</small><strong>{view === 'all' ? 'All Media' : view === 'missing' ? 'Missing Media' : selectedFolder?.name ?? 'Library Root'}</strong></span>
          <span><small>FILES</small><strong>{assets.length}</strong></span>
          <span><small>SIZE</small><strong>{bytes(assets.reduce((sum, asset) => sum + asset.size, 0))}</strong></span>
          <span><small>ACTIVE SONG</small><strong>{p.activeSong?.name ?? 'None selected'}</strong></span>
        </div>

        <div className="media-asset-list">
          {assets.map((asset) => {
            const useCount = p.mediaUseCounts[asset.id] ?? 0;
            return <article key={asset.id} className={asset.missing ? 'missing' : ''}>
              <div className="media-asset-type"><span>{asset.kind.toUpperCase()}</span><b>{asset.sourceMode === 'copy' ? 'MANAGED' : 'REFERENCE'}</b></div>
              <div className="media-asset-info">
                <strong>{asset.name}</strong>
                <small>{bytes(asset.size)} · {asset.missing ? 'MISSING' : 'Available'} · used {useCount}×</small>
                <code title={asset.path}>{asset.path}</code>
              </div>
              <label className="media-folder-select"><span>Folder</span><select value={asset.folderId ?? ''} onChange={(event) => void run(`move-${asset.id}`, async () => {
                await moveMediaAsset(asset.id, event.target.value || null);
              })}>
                <option value="">Library Root</option>
                {library.folders.map((folder) => <option key={folder.id} value={folder.id}>{'  '.repeat(folderDepth(folder.id, library))}{folder.name}</option>)}
              </select></label>
              <div className="media-asset-actions">
                <button disabled={!p.activeSong || asset.missing || !!busy} onClick={() => void run(`attach-${asset.id}`, async () => {
                  await p.onAttachToActiveSong(asset);
                })}>{p.activeSong ? `Use on ${p.activeSong.name}` : 'Select a Song first'}</button>
                <button className={asset.missing ? 'console-primary' : ''} disabled={!!busy} onClick={() => void run(`relink-${asset.id}`, async () => {
                  const updated = await relinkMediaAsset(asset.id);
                  if (updated) p.onAssetChanged(updated);
                })}>{asset.missing ? 'Relink Missing File' : 'Relink'}</button>
                <button className="danger-outline" disabled={useCount > 0 || !!busy} title={useCount > 0 ? 'Remove it from Songs/timelines before deleting the library asset.' : 'Remove from Media Library'} onClick={() => void run(`remove-${asset.id}`, async () => {
                  await removeMediaAsset(asset.id);
                })}>Remove</button>
              </div>
            </article>;
          })}
          {!assets.length && <div className="media-library-empty">
            <strong>{view === 'missing' ? 'No missing media.' : 'No media in this view.'}</strong>
            <span>Import a managed copy or reference a file in place.</span>
          </div>}
        </div>
      </main>
    </div>
  </div>;
}
