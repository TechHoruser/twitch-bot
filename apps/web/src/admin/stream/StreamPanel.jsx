'use client';
import { useEffect, useRef, useState } from 'react';

const getInfo = () => fetch('/api/admin/channel').then((r) => r.json());
const save = (body) => fetch('/api/admin/channel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json());
const searchGames = (q) => fetch(`/api/admin/channel/categories?q=${encodeURIComponent(q)}`).then((r) => r.json());

const MAX_TITLE = 140;

// Editor del título y la categoría/juego del directo (Helix Modify Channel
// Information). El juego se elige con autocompletado contra la búsqueda de Twitch.
export function StreamPanel() {
  const [title, setTitle] = useState('');
  const [game, setGame] = useState({ id: '', name: '' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    getInfo().then((d) => {
      if (d?.ok) { setTitle(d.title || ''); setGame({ id: d.gameId || '', name: d.gameName || '' }); }
      else setToast(`✗ ${d?.error || 'no se pudo cargar'}`);
      setLoading(false);
    });
  }, []);

  const onQuery = (v) => {
    setQuery(v);
    setOpen(true);
    clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      const d = await searchGames(v.trim());
      setResults(d?.categories || []);
    }, 300);
  };

  const pickGame = (g) => { setGame({ id: g.id, name: g.name }); setQuery(''); setResults([]); setOpen(false); };

  const notify = (text) => { setToast(text); setTimeout(() => setToast(null), 3000); };

  const onSave = async () => {
    setSaving(true);
    const res = await save({ title, gameId: game.id });
    setSaving(false);
    notify(res?.ok ? '✓ Directo actualizado' : `✗ ${res?.error || 'error'}`);
  };

  if (loading) return <p className="opacity-60">Cargando información del directo…</p>;

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <h2 className="text-lg font-semibold">📡 Información del directo</h2>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-widest opacity-60">Título</span>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          rows={2}
          className="bg-white/10 rounded px-3 py-2 resize-none"
          placeholder="Título del directo"
        />
        <span className="text-xs opacity-40 self-end">{title.length}/{MAX_TITLE}</span>
      </label>

      <div className="flex flex-col gap-1 relative">
        <span className="text-xs uppercase tracking-widest opacity-60">Juego / categoría</span>
        <div className="bg-white/10 rounded px-3 py-2 opacity-90">{game.name || 'sin categoría'}</div>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className="bg-white/10 rounded px-3 py-2 mt-1"
          placeholder="Buscar otra categoría…"
        />
        {open && results.length > 0 && (
          <ul className="absolute top-full mt-1 w-full z-10 bg-neutral-800 border border-white/10 rounded max-h-60 overflow-y-auto">
            {results.map((g) => (
              <li key={g.id}>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2"
                  onClick={() => pickGame(g)}
                >
                  {g.boxArt && (
                    <img
                      src={g.boxArt.replace('{width}', '24').replace('{height}', '32')}
                      alt=""
                      className="w-6 h-8 object-cover rounded shrink-0"
                    />
                  )}
                  <span>{g.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="self-start bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded px-4 py-2 font-semibold transition"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>

      {toast && <div className="text-sm">{toast}</div>}
    </div>
  );
}
