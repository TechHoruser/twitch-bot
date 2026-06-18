'use client';
import { useCallback, useEffect, useState } from 'react';

const api = (body) => fetch('/api/admin/music/playlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json());

export function PlaylistEditor({ refreshKey }) {
  const [library, setLibrary] = useState({ playlists: {} });
  const [selected, setSelected] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    const lib = await fetch('/api/admin/music/playlist').then((r) => r.json());
    setLibrary(lib);
    const names = Object.keys(lib.playlists || {});
    setSelected((prev) => (prev && names.includes(prev) ? prev : names[0] || null));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setTracks(library.playlists?.[selected] || []); }, [selected, library]);

  const move = (i, d) => {
    const arr = [...tracks];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setTracks(arr);
  };
  const remove = (i) => setTracks(tracks.filter((_, k) => k !== i));
  const saveOrder = () => api({ action: 'save', name: selected, tracks }).then(setLibrary);
  const createPlaylist = () => {
    const n = newName.trim();
    if (n) { api({ action: 'save', name: n, tracks: [] }).then(setLibrary); setSelected(n); setNewName(''); }
  };
  const del = () => selected && api({ action: 'delete', name: selected }).then(setLibrary);

  const names = Object.keys(library.playlists || {});

  return (
    <div className="rounded-lg p-4 bg-white/5 flex flex-col gap-3">
      <h3 className="font-semibold">Playlists</h3>

      <div className="flex gap-2 flex-wrap">
        {names.map((n) => (
          <button key={n} onClick={() => setSelected(n)} className={`px-3 py-1 rounded text-sm ${selected === n ? 'bg-emerald-500' : 'bg-white/10 hover:bg-white/20'}`}>
            {n} <span className="opacity-60">({library.playlists[n].length})</span>
          </button>
        ))}
        {names.length === 0 && <span className="text-sm opacity-50">No hay playlists todavía.</span>}
      </div>

      <div className="flex gap-2">
        <input className="bg-neutral-800 rounded px-2 py-1 flex-1" placeholder="nueva playlist" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="bg-white/10 hover:bg-white/20 rounded px-3" onClick={createPlaylist}>+ Crear</button>
      </div>

      {selected && (
        <>
          <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {tracks.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2 text-sm bg-black/20 rounded px-2 py-1">
                <span className="flex-1 truncate">{t.title} <span className="opacity-60">· {t.artist}</span></span>
                <button onClick={() => move(i, -1)} className="opacity-70 hover:opacity-100">▲</button>
                <button onClick={() => move(i, 1)} className="opacity-70 hover:opacity-100">▼</button>
                <button onClick={() => remove(i)} className="text-red-400">✕</button>
              </li>
            ))}
            {tracks.length === 0 && <li className="opacity-50 text-sm">Vacía. Descarga música a esta playlist.</li>}
          </ul>
          <div className="flex gap-2">
            <button className="bg-emerald-500 hover:bg-emerald-600 rounded px-3 py-1 font-semibold" onClick={saveOrder}>Guardar orden</button>
            <button className="bg-red-500/70 hover:bg-red-500 rounded px-3 py-1" onClick={del}>Borrar playlist</button>
          </div>
        </>
      )}
    </div>
  );
}
