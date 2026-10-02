import type { SupabaseClient } from '@supabase/supabase-js';
import { getLumaSupabaseClient } from './supabase-client';
import { normalizeRoomCode, type RemoteRelayConfig } from './remote-relay';

export type CloudShowFolder = {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudShowDocument = {
  showId: string;
  folderId: string | null;
  name: string;
  status: 'template' | 'draft' | 'show';
  snapshot: unknown;
  revision: number;
  lastEditor: string;
  updatedByDevice: string | null;
  updatedAt: string;
};

export type CloudShowSaveResult = {
  showId: string;
  revision: number;
  updatedAt: string;
  conflict: boolean;
};

export type ControllerPairingSession = {
  id: string;
  code: string;
  token: string;
  pairingUrl: string;
  expiresAt: string;
};

export type PairedController = {
  id: string;
  deviceUserId: string;
  deviceName: string;
  relayRoom: string;
  createdAt: string;
  lastSeenAt: string;
};

function cleanConfig(config: RemoteRelayConfig) {
  const url = config.url.trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) throw new Error('Enter the HTTPS Supabase project URL.');
  if (!config.publishableKey.trim()) throw new Error('Enter the Supabase publishable key.');
  return { url, publishableKey: config.publishableKey.trim() };
}

export async function operatorClient(config: RemoteRelayConfig): Promise<{ client: SupabaseClient; userId: string }> {
  const { url, publishableKey } = cleanConfig(config);
  const client = getLumaSupabaseClient(url, publishableKey);
  let session = (await client.auth.getSession()).data.session;
  const desiredEmail = config.email.trim().toLowerCase();
  const sessionEmail = session?.user.email?.toLowerCase() || '';
  const sessionUsable = Boolean(session && !session.user.is_anonymous && (!desiredEmail || sessionEmail === desiredEmail));
  if (!sessionUsable) {
    if (!desiredEmail || !config.password) throw new Error('Sign in to LumaRig Cloud on this computer first.');
    const result = await client.auth.signInWithPassword({ email: desiredEmail, password: config.password });
    if (result.error) throw result.error;
    session = result.data.session;
  }
  if (!session || session.user.is_anonymous) throw new Error('Supabase operator session is unavailable.');
  return { client, userId: session.user.id };
}

function dbError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

export async function fetchCloudShowLibrary(config: RemoteRelayConfig): Promise<{ folders: CloudShowFolder[]; shows: CloudShowDocument[] }> {
  const { client } = await operatorClient(config);
  const [foldersResult, showsResult] = await Promise.all([
    client.from('lumarig_show_folders').select('id,parent_id,name,created_at,updated_at').order('name'),
    client.from('lumarig_show_documents')
      .select('show_id,folder_id,name,status,snapshot,revision,last_editor,updated_by_device,updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
  ]);
  dbError(foldersResult.error, 'Cloud folders could not be loaded.');
  dbError(showsResult.error, 'Cloud shows could not be loaded.');
  return {
    folders: (foldersResult.data ?? []).map((row) => ({
      id: String(row.id),
      parentId: row.parent_id ? String(row.parent_id) : null,
      name: String(row.name),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    })),
    shows: (showsResult.data ?? []).map((row) => ({
      showId: String(row.show_id),
      folderId: row.folder_id ? String(row.folder_id) : null,
      name: String(row.name),
      status: row.status as CloudShowDocument['status'],
      snapshot: row.snapshot,
      revision: Number(row.revision),
      lastEditor: String(row.last_editor || 'lumarig'),
      updatedByDevice: row.updated_by_device ? String(row.updated_by_device) : null,
      updatedAt: String(row.updated_at)
    }))
  };
}

export async function createCloudShowFolder(config: RemoteRelayConfig, name: string, parentId: string | null = null): Promise<CloudShowFolder> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Folder name is required.');
  const { client, userId } = await operatorClient(config);
  const result = await client.from('lumarig_show_folders')
    .insert({ user_id: userId, parent_id: parentId, name: cleanName })
    .select('id,parent_id,name,created_at,updated_at')
    .single();
  dbError(result.error, 'Cloud folder could not be created.');
  if (!result.data) throw new Error('Cloud folder could not be created.');
  return {
    id: String(result.data.id),
    parentId: result.data.parent_id ? String(result.data.parent_id) : null,
    name: String(result.data.name),
    createdAt: String(result.data.created_at),
    updatedAt: String(result.data.updated_at)
  };
}

export async function saveCloudShow(config: RemoteRelayConfig, input: {
  showId: string;
  name: string;
  status: 'template' | 'draft' | 'show';
  snapshot: unknown;
  folderId: string | null;
  expectedRevision: number;
  deviceId?: string;
}): Promise<CloudShowSaveResult> {
  const { client } = await operatorClient(config);
  const result = await client.rpc('lumarig_save_show', {
    p_show_id: input.showId,
    p_name: input.name,
    p_status: input.status,
    p_snapshot: input.snapshot,
    p_folder_id: input.folderId,
    p_expected_revision: input.expectedRevision,
    p_last_editor: 'lumarig',
    p_device_id: input.deviceId || 'mac'
  }).single();
  dbError(result.error, 'Cloud show could not be saved.');
  const data = result.data as { show_id?: unknown; revision?: unknown; updated_at?: unknown; conflict?: unknown } | null;
  if (!data?.show_id || data.revision == null || !data.updated_at) throw new Error('Cloud show save returned no result.');
  return {
    showId: String(data.show_id),
    revision: Number(data.revision),
    updatedAt: String(data.updated_at),
    conflict: Boolean(data.conflict)
  };
}

const CLOUD_MEDIA_BUCKET = 'lumarig-show-media';

function safeObjectSegment(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '_').slice(0, 180);
}

function cloudMediaPath(userId: string, showId: string, mediaId: string) {
  return `${userId}/${safeObjectSegment(showId)}/${safeObjectSegment(mediaId)}`;
}

export async function uploadCloudShowMedia(
  config: RemoteRelayConfig,
  showId: string,
  mediaId: string,
  blob: Blob
) {
  const { client, userId } = await operatorClient(config);
  const folder = `${userId}/${safeObjectSegment(showId)}`;
  const objectName = safeObjectSegment(mediaId);
  const existing = await client.storage.from(CLOUD_MEDIA_BUCKET).list(folder, {
    limit: 2,
    search: objectName
  });
  dbError(existing.error, 'Cloud media could not be checked.');
  if ((existing.data ?? []).some((entry) => entry.name === objectName)) return;

  const result = await client.storage.from(CLOUD_MEDIA_BUCKET).upload(
    `${folder}/${objectName}`,
    blob,
    {
      upsert: false,
      contentType: blob.type || 'application/octet-stream',
      cacheControl: '3600'
    }
  );
  dbError(result.error, 'Show media could not be uploaded.');
}

export async function downloadCloudShowMedia(
  config: RemoteRelayConfig,
  showId: string,
  mediaId: string
): Promise<Blob> {
  const { client, userId } = await operatorClient(config);
  const result = await client.storage.from(CLOUD_MEDIA_BUCKET).download(
    cloudMediaPath(userId, showId, mediaId)
  );
  dbError(result.error, 'Show media could not be downloaded.');
  if (!result.data) throw new Error('Cloud media returned no file.');
  return result.data;
}

function randomPairingCode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(6, '0');
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

export async function createControllerPairing(config: RemoteRelayConfig, remoteAppUrl: string): Promise<ControllerPairingSession> {
  const relayRoom = normalizeRoomCode(config.roomCode);
  if (relayRoom.length < 12) throw new Error('Generate a relay room before pairing a controller.');
  const { client, userId } = await operatorClient(config);

  // A LumaRig desktop only needs one active claim window. Claimed devices remain paired.
  const cleanup = await client.from('lumarig_controller_pairings')
    .delete()
    .eq('operator_id', userId)
    .is('claimed_at', null);
  dbError(cleanup.error, 'Previous pairing session could not be cleared.');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomPairingCode();
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const insert = await client.from('lumarig_controller_pairings')
      .insert({
        operator_id: userId,
        code_hash: await sha256Hex(code),
        token_hash: await sha256Hex(token),
        relay_room: relayRoom,
        expires_at: expiresAt
      })
      .select('id')
      .single();

    if (insert.error?.code === '23505') continue;
    dbError(insert.error, 'Pairing session could not be created.');
    if (!insert.data) throw new Error('Pairing session could not be created.');

    const pairingUrl = new URL(remoteAppUrl);
    pairingUrl.pathname = '/';
    pairingUrl.search = '';
    pairingUrl.searchParams.set('code', code);
    pairingUrl.searchParams.set('token', token);
    return { id: String(insert.data.id), code, token, pairingUrl: pairingUrl.toString(), expiresAt };
  }
  throw new Error('Could not allocate a pairing code. Try again.');
}

export async function listPairedControllers(config: RemoteRelayConfig): Promise<PairedController[]> {
  const { client, userId } = await operatorClient(config);
  const result = await client.from('lumarig_controller_devices')
    .select('id,device_user_id,device_name,relay_room,created_at,last_seen_at')
    .eq('operator_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  dbError(result.error, 'Paired controllers could not be loaded.');
  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    deviceUserId: String(row.device_user_id),
    deviceName: String(row.device_name),
    relayRoom: String(row.relay_room),
    createdAt: String(row.created_at),
    lastSeenAt: String(row.last_seen_at)
  }));
}

export async function revokePairedController(config: RemoteRelayConfig, deviceId: string) {
  const { client, userId } = await operatorClient(config);
  const result = await client.from('lumarig_controller_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('operator_id', userId)
    .eq('id', deviceId);
  dbError(result.error, 'Controller could not be revoked.');
}

export type CloudAccount = { userId: string; email: string; };
export type CloudSongDocument = {
  songId: string; title: string; artist: string; bpm: number; musicalKey: string;
  arrangement: string[]; notes: string; program: unknown; revision: number; updatedAt: string;
};
export type CloudRecordingLabel = {
  takeId: string; songId: string | null; showId: string | null; label: string; notes: string; updatedAt: string;
};

export async function currentCloudAccount(config: RemoteRelayConfig): Promise<CloudAccount | null> {
  const { url, publishableKey } = cleanConfig(config);
  const client = getLumaSupabaseClient(url, publishableKey);
  const session = (await client.auth.getSession()).data.session;
  if (!session || session.user.is_anonymous) return null;
  return { userId: session.user.id, email: session.user.email || config.email || '' };
}

export async function signInCloudAccount(config: RemoteRelayConfig, email: string, password: string): Promise<CloudAccount> {
  const { url, publishableKey } = cleanConfig(config);
  const client = getLumaSupabaseClient(url, publishableKey);
  const result = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (result.error) throw result.error;
  if (!result.data.session || result.data.user.is_anonymous) throw new Error('LumaRig Cloud did not return a permanent account session.');
  return { userId: result.data.user.id, email: result.data.user.email || email.trim().toLowerCase() };
}

export async function signOutCloudAccount(config: RemoteRelayConfig) {
  const { url, publishableKey } = cleanConfig(config);
  const client = getLumaSupabaseClient(url, publishableKey);
  const result = await client.auth.signOut();
  if (result.error) throw result.error;
}

export async function fetchCloudSongLibrary(config: RemoteRelayConfig): Promise<CloudSongDocument[]> {
  const { client } = await operatorClient(config);
  const result = await client.from('lumarig_song_documents')
    .select('song_id,title,artist,bpm,musical_key,arrangement,notes,program,revision,updated_at')
    .is('deleted_at', null).order('updated_at', { ascending: false });
  dbError(result.error, 'Cloud Song Library could not be loaded.');
  return (result.data ?? []).map((row) => ({
    songId: String(row.song_id), title: String(row.title), artist: String(row.artist || ''),
    bpm: Number(row.bpm), musicalKey: String(row.musical_key || ''),
    arrangement: Array.isArray(row.arrangement) ? row.arrangement.map(String) : [],
    notes: String(row.notes || ''), program: row.program, revision: Number(row.revision), updatedAt: String(row.updated_at)
  }));
}

export async function saveCloudSong(config: RemoteRelayConfig, input: {
  songId: string; title: string; artist?: string; bpm: number; musicalKey?: string;
  arrangement?: string[]; notes?: string; program: unknown; expectedRevision?: number; deviceId?: string;
}) {
  const { client } = await operatorClient(config);
  const result = await client.rpc('lumarig_save_song', {
    p_song_id: input.songId, p_title: input.title, p_artist: input.artist || '', p_bpm: input.bpm,
    p_musical_key: input.musicalKey || '', p_arrangement: input.arrangement || [], p_notes: input.notes || '',
    p_program: input.program, p_expected_revision: input.expectedRevision ?? 0, p_device_id: input.deviceId || 'lumarig-desktop'
  }).single();
  dbError(result.error, 'Cloud Song could not be saved.');
  const data = result.data as { song_id?: unknown; revision?: unknown; updated_at?: unknown; conflict?: unknown } | null;
  if (!data?.song_id || data.revision == null || !data.updated_at) throw new Error('Cloud Song save returned no result.');
  return { songId: String(data.song_id), revision: Number(data.revision), updatedAt: String(data.updated_at), conflict: Boolean(data.conflict) };
}

export async function fetchCloudRecordingLabels(config: RemoteRelayConfig): Promise<CloudRecordingLabel[]> {
  const { client } = await operatorClient(config);
  const result = await client.from('lumarig_recording_labels').select('take_id,song_id,show_id,label,notes,updated_at').order('updated_at', { ascending: false });
  dbError(result.error, 'Cloud recorded-take labels could not be loaded.');
  return (result.data ?? []).map((row) => ({
    takeId: String(row.take_id), songId: row.song_id ? String(row.song_id) : null, showId: row.show_id ? String(row.show_id) : null,
    label: String(row.label || 'Recorded Take'), notes: String(row.notes || ''), updatedAt: String(row.updated_at)
  }));
}

export async function saveCloudRecordingLabel(config: RemoteRelayConfig, input: { takeId: string; songId?: string | null; showId?: string | null; label: string; notes?: string; }) {
  const { client, userId } = await operatorClient(config);
  const result = await client.from('lumarig_recording_labels').upsert({
    user_id: userId, take_id: input.takeId, song_id: input.songId || null, show_id: input.showId || null,
    label: input.label.trim() || 'Recorded Take', notes: input.notes || ''
  }, { onConflict: 'user_id,take_id' });
  dbError(result.error, 'Recorded-take label could not be saved.');
}

export async function watchCloudLibrary(config: RemoteRelayConfig, onChange: () => void) {
  const { client, userId } = await operatorClient(config);
  const channel = client.channel('lumarig-cloud-library-' + userId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lumarig_song_documents', filter: 'user_id=eq.' + userId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lumarig_show_documents', filter: 'user_id=eq.' + userId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lumarig_recording_labels', filter: 'user_id=eq.' + userId }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
