import path from 'path';
import fs from 'fs';
import { fetchTracks, downloadTrack, PLAYLISTS } from '@stream-toolkit/common/jamendo';
import { getLibrary, savePlaylist } from '@stream-toolkit/common/music';

// Descarga música de Jamendo a apps/web/public/music/<playlist>/ y la añade a la
// playlist en el manifiesto. cwd de la web (workspace apps/web) → public/ correcto.
export async function POST(request) {
  const { playlist, tag, limit } = await request.json().catch(() => ({}));
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: 'Falta JAMENDO_CLIENT_ID en apps/web/.env.local' }, { status: 400 });
  }

  const name = (playlist || 'custom').trim();
  const fuzzytags = (tag || PLAYLISTS[name] || name).trim();

  try {
    const tracks = await fetchTracks({ clientId, fuzzytags, limit: Number(limit) || 10 });
    const dir = path.join(process.cwd(), 'public', 'music', name);
    fs.mkdirSync(dir, { recursive: true });

    // Acumula sobre lo que ya hubiera en la playlist (sin duplicar por id).
    const byId = new Map((getLibrary().playlists[name] || []).map((e) => [e.id, e]));
    let added = 0;
    for (const t of tracks) {
      const { entry, skipped } = await downloadTrack(t, dir);
      byId.set(entry.id, entry);
      if (!skipped) added++;
    }
    savePlaylist(name, [...byId.values()]);

    return Response.json({ ok: true, playlist: name, fuzzytags, total: byId.size, added });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
