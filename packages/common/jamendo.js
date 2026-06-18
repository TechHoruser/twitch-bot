// Núcleo de descarga de Jamendo, reutilizado por el CLI (setup-music.js) y la API
// de /admin (/api/admin/music/download). Solo módulos de Node (fetch nativo).
const fs = require('fs');
const path = require('path');

// Playlists por defecto → tags de Jamendo (fuzzytags).
const PLAYLISTS = {
  lofi: 'lofi+chill',
  chill: 'chillout+ambient',
  epic: 'epic+cinematic',
  electronic: 'electronic+edm',
  rock: 'rock+energetic',
};

// Devuelve las pistas descargables (audiodownload_allowed) para unos tags.
async function fetchTracks({ clientId, fuzzytags, limit = 12 }) {
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.search = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: String(limit),
    fuzzytags,
    audioformat: 'mp32',
    audiodlformat: 'mp32',
    include: 'musicinfo licenses',
    order: 'popularity_total',
    groupby: 'artist_id',
  }).toString();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jamendo respondió ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json?.headers?.status && json.headers.status !== 'success') {
    throw new Error(`Jamendo: ${json.headers.error_message || 'error desconocido'}`);
  }
  return (Array.isArray(json.results) ? json.results : [])
    .filter((t) => t.audiodownload_allowed && t.audiodownload);
}

// Convierte una pista de Jamendo en una entrada del manifiesto.
const toEntry = (track) => ({
  id: String(track.id),
  file: `${track.id}.mp3`,
  title: track.name,
  artist: track.artist_name,
  duration: Number(track.duration) || 0,
  licenseUrl: track.license_ccurl || '',
});

// Descarga una pista a <dir>/<id>.mp3 (salta si ya existe). Devuelve { entry, skipped }.
async function downloadTrack(track, dir) {
  const entry = toEntry(track);
  const dest = path.join(dir, entry.file);
  if (fs.existsSync(dest)) return { entry, skipped: true };
  const res = await fetch(track.audiodownload);
  if (!res.ok) throw new Error(`descarga ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return { entry, skipped: false };
}

module.exports = { PLAYLISTS, fetchTracks, downloadTrack, toEntry };
