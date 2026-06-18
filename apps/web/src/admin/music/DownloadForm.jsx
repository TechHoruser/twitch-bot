'use client';
import { useState } from 'react';

export function DownloadForm({ onDone }) {
  const [playlist, setPlaylist] = useState('lofi');
  const [tag, setTag] = useState('');
  const [limit, setLimit] = useState(8);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/music/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist, tag: tag || undefined, limit }),
      }).then((r) => r.json());
      setResult(res.ok ? `✓ ${res.added} nuevas · ${res.total} en "${res.playlist}"` : `✗ ${res.error}`);
      if (res.ok) onDone?.();
    } catch (e) {
      setResult('✗ ' + e.message);
    }
    setBusy(false);
  };

  return (
    <div className="rounded-lg p-4 bg-white/5 flex flex-col gap-2">
      <h3 className="font-semibold">Descargar de Jamendo</h3>
      <div className="flex gap-2 flex-wrap items-center">
        <input className="bg-neutral-800 rounded px-2 py-1 w-28" placeholder="playlist" value={playlist} onChange={(e) => setPlaylist(e.target.value)} />
        <input className="bg-neutral-800 rounded px-2 py-1 flex-1 min-w-[8rem]" placeholder="tags (p.ej. lofi+chill) — opcional" value={tag} onChange={(e) => setTag(e.target.value)} />
        <input className="bg-neutral-800 rounded px-2 py-1 w-16" type="number" min="1" max="50" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
        <button className="bg-emerald-500 hover:bg-emerald-600 rounded px-3 py-1 font-semibold disabled:opacity-50" disabled={busy} onClick={run}>
          {busy ? 'Descargando…' : 'Descargar'}
        </button>
      </div>
      {result && <p className="text-sm opacity-80">{result}</p>}
      <p className="text-xs opacity-50">Sin tags usa los del nombre de playlist (lofi, chill, epic, electronic, rock). Necesita JAMENDO_CLIENT_ID.</p>
    </div>
  );
}
