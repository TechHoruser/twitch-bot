'use client';
import { useEffect, useRef, useState } from 'react';
import { useStreamStatus } from './useStreamStatus';

const getInfo = () => fetch('/api/admin/channel').then((r) => r.json());
const save = (body) => fetch('/api/admin/channel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json());
const searchGames = (q) => fetch(`/api/admin/channel/categories?q=${encodeURIComponent(q)}`).then((r) => r.json());

const MAX_TITLE = 140;

const setBroadcast = (action) => fetch('/api/admin/stream/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action }),
}).then((r) => r.json());

// Tiempo transcurrido desde started_at en formato h:mm:ss.
const uptimeOf = (startedAt) => {
  if (!startedAt) return null;
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// Panel de retransmisión: estado en vivo, número de espectadores y botón para
// iniciar/detener la emisión (vía OBS). `presentCount` = usuarios en el chat ahora.
function BroadcastPanel({ presentCount }) {
  const { data, loading, refresh } = useStreamStatus();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [, setTick] = useState(0);

  // Refresca el cronómetro de tiempo en directo cada segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const notify = (text) => { setToast(text); setTimeout(() => setToast(null), 3500); };

  // En OBS mandamos: si OBS ya emite (o Twitch detecta directo) → detener; si no → iniciar.
  const streaming = data?.obsStreaming ?? data?.live ?? false;

  const onToggle = async () => {
    setBusy(true);
    const res = await setBroadcast(streaming ? 'stop' : 'start');
    setBusy(false);
    if (res?.ok) {
      notify(streaming ? '⏹ Retransmisión detenida' : '▶ Retransmisión iniciada');
      refresh();
    } else {
      notify(`✗ ${res?.error || 'error'}`);
    }
  };

  const live = data?.live;
  const uptime = uptimeOf(data?.startedAt);

  return (
    <div className="rounded-lg p-4 bg-white/5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">📡 Retransmisión</h2>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${live ? 'bg-red-500/80 text-white' : 'bg-white/10 text-white/60'}`}>
          {loading ? '…' : live ? '● EN DIRECTO' : '○ offline'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded bg-black/30 px-3 py-2">
          <div className="text-2xl font-bold tabular-nums">{live ? (data?.viewerCount ?? 0) : '—'}</div>
          <div className="text-xs uppercase tracking-widest opacity-60">Espectadores</div>
        </div>
        <div className="rounded bg-black/30 px-3 py-2">
          <div className="text-2xl font-bold tabular-nums">{presentCount ?? '—'}</div>
          <div className="text-xs uppercase tracking-widest opacity-60">En el chat</div>
        </div>
        <div className="rounded bg-black/30 px-3 py-2">
          <div className="text-2xl font-bold tabular-nums">{live && uptime ? uptime : '—'}</div>
          <div className="text-xs uppercase tracking-widest opacity-60">En directo</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={busy}
          className={`rounded px-4 py-2 font-semibold transition disabled:opacity-50 ${
            streaming ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {busy ? 'Procesando…' : streaming ? '⏹ Detener retransmisión' : '▶ Iniciar retransmisión'}
        </button>
        {data?.obsStreaming === null && (
          <span className="text-xs text-amber-400/80">OBS no conectado · el botón requiere obs-websocket</span>
        )}
      </div>

      {toast && <div className="text-sm">{toast}</div>}
    </div>
  );
}

// Editor del título y la categoría/juego del directo (Helix Modify Channel
// Information). El juego se elige con autocompletado contra la búsqueda de Twitch.
export function StreamPanel({ presentCount }) {
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

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <BroadcastPanel presentCount={presentCount} />

      {loading ? (
        <p className="opacity-60">Cargando información del directo…</p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
