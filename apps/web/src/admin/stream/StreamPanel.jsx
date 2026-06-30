'use client';
import { useEffect, useRef, useState } from 'react';
import { useStreamStatus } from './useStreamStatus';
import { GAMES, THEMES } from '../../scenes/themes';
import { COUNTDOWN_MINUTES, INTRO_GRACE_SECONDS } from '../../scenes/config';

const getInfo = () => fetch('/api/admin/channel').then((r) => r.json());
const save = (body) => fetch('/api/admin/channel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json());
const searchGames = (q) => fetch(`/api/admin/channel/categories?q=${encodeURIComponent(q)}`).then((r) => r.json());

const MAX_TITLE = 140;

// Memoria por colección (tema) del título, categoría y notificación usados, para
// pre-rellenar el formulario al elegir esa colección.
const SETUP_KEY = (collection) => `broadcastSetup:${collection}`;
const LAST_KEY = 'broadcastSetup:last';
const loadSetup = (collection) => {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SETUP_KEY(collection)) || 'null'); } catch { return null; }
};
const saveSetup = (collection, data) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETUP_KEY(collection), JSON.stringify(data));
  localStorage.setItem(LAST_KEY, collection);
};
const loadLastCollection = () => {
  if (typeof window === 'undefined') return GAMES[0];
  return localStorage.getItem(LAST_KEY) || GAMES[0];
};

// mm:ss a partir de milisegundos.
const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const setBroadcast = (action, extra = {}) => fetch('/api/admin/stream/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action, ...extra }),
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

const MAX_ANNOUNCE = 500;

// Formulario previo a ponerse en directo: elige la colección de escenas y fija
// título, categoría y notificación (anuncio de chat). Cada colección recuerda en
// localStorage sus últimos valores. Al iniciar, precarga la pantalla de entrada de
// la colección y (si se marca) programa el paso automático a la principal.
function BroadcastSetupModal({ onClose, onStarted, intro }) {
  const [collection, setCollection] = useState(loadLastCollection);
  const [title, setTitle] = useState('');
  const [game, setGame] = useState({ id: '', name: '' });
  const [announcement, setAnnouncement] = useState('');
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const channelRef = useRef({ title: '', gameId: '', gameName: '' });

  // Aplica al formulario los valores guardados de una colección; si no hay, usa la
  // info actual del canal (título/categoría) y notificación vacía.
  const applyCollection = (col) => {
    const saved = loadSetup(col);
    if (saved) {
      setTitle(saved.title || '');
      setGame({ id: saved.gameId || '', name: saved.gameName || '' });
      setAnnouncement(saved.announcement || '');
      setAutoSwitch(saved.autoSwitch ?? true);
    } else {
      const c = channelRef.current;
      setTitle(c.title || '');
      setGame({ id: c.gameId || '', name: c.gameName || '' });
      setAnnouncement('');
      setAutoSwitch(true);
    }
  };

  useEffect(() => {
    getInfo().then((d) => {
      if (d?.ok) channelRef.current = { title: d.title || '', gameId: d.gameId || '', gameName: d.gameName || '' };
      applyCollection(collection);
      setLoading(false);
    });
  }, []);

  const onPickCollection = (col) => { setCollection(col); applyCollection(col); };

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

  const start = async () => {
    setSubmitting(true);
    setError(null);
    const res = await setBroadcast('start', { title, gameId: game.id, announcement });
    setSubmitting(false);
    if (res?.ok) {
      saveSetup(collection, { title, gameId: game.id, gameName: game.name, announcement, autoSwitch });
      intro?.start({ collection, autoSwitch });
      onStarted(res);
      onClose();
    } else {
      setError(res?.error || 'No se pudo iniciar la retransmisión');
    }
  };

  const showAutoSwitch = COUNTDOWN_MINUTES > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-neutral-800 text-white rounded-lg w-full max-w-lg p-6 flex flex-col gap-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">▶ Iniciar retransmisión</h2>

        {loading ? (
          <p className="opacity-60">Cargando datos del directo…</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-widest opacity-60">Colección de escenas</span>
              <div className="flex gap-2 flex-wrap">
                {GAMES.map((g) => (
                  <button
                    key={g}
                    onClick={() => onPickCollection(g)}
                    className={`px-3 py-1.5 rounded text-sm font-semibold transition ${
                      collection === g ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
                    }`}
                  >
                    {THEMES[g].label}
                  </button>
                ))}
              </div>
              <span className="text-xs opacity-50">
                Se cargará su escena de entrada y se recordarán título, categoría y notificación.
              </span>
            </div>

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
                <ul className="absolute top-full mt-1 w-full z-10 bg-neutral-900 border border-white/10 rounded max-h-60 overflow-y-auto">
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

            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-widest opacity-60">
                Notificación (anuncio en el chat)
              </span>
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value.slice(0, MAX_ANNOUNCE))}
                rows={2}
                className="bg-white/10 rounded px-3 py-2 resize-none"
                placeholder="Ej.: ¡Ya estamos en directo! Pasad a saludar 👋"
              />
              <span className="text-xs opacity-40 self-end">{announcement.length}/{MAX_ANNOUNCE}</span>
            </label>

            <p className="text-xs opacity-50 -mt-1">
              La notificación se publica como anuncio destacado en el chat. El aviso a
              seguidores (go-live) lo gestiona Twitch automáticamente y no se puede fijar por API.
            </p>

            {showAutoSwitch && (
              <label className="flex items-start gap-2 text-sm bg-white/5 rounded px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSwitch}
                  onChange={(e) => setAutoSwitch(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Pasar a la escena principal automáticamente {INTRO_GRACE_SECONDS}s después de que la cuenta atrás llegue a 0 (mostrando ¡EMPEZAMOS!)
                  <span className="opacity-50"> ({COUNTDOWN_MINUTES} min)</span>
                </span>
              </label>
            )}

            {error && <div className="text-sm text-red-400">✗ {error}</div>}

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="rounded px-4 py-2 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={start}
                disabled={submitting}
                className="rounded px-4 py-2 font-semibold bg-emerald-500 hover:bg-emerald-600 transition disabled:opacity-50"
              >
                {submitting ? 'Iniciando…' : '▶ Iniciar directo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Panel de retransmisión: estado en vivo, número de espectadores y botón para
// iniciar/detener la emisión (vía OBS). `presentCount` = usuarios en el chat ahora.
// `intro` = control de la escena de entrada / cuenta atrás (useBroadcastIntro).
function BroadcastPanel({ presentCount, intro }) {
  const { data, loading, refresh } = useStreamStatus();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [confirmMain, setConfirmMain] = useState(false);
  const [, setTick] = useState(0);

  // Refresca el cronómetro de tiempo en directo cada segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const notify = (text) => { setToast(text); setTimeout(() => setToast(null), 3500); };

  // En OBS mandamos: si OBS ya emite (o Twitch detecta directo) → detener; si no → iniciar.
  const streaming = data?.obsStreaming ?? data?.live ?? false;

  // Iniciar abre el formulario previo (título/categoría/notificación); detener es directo.
  const onToggle = async () => {
    if (!streaming) { setShowSetup(true); return; }
    setBusy(true);
    const res = await setBroadcast('stop');
    setBusy(false);
    notify(res?.ok ? '⏹ Retransmisión detenida' : `✗ ${res?.error || 'error'}`);
    if (res?.ok) refresh();
  };

  const onStarted = (res) => {
    const warn = res?.warnings?.length ? ` (${res.warnings.join('; ')})` : '';
    notify(`▶ Retransmisión iniciada${warn}`);
    refresh();
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

      {/* Escena de entrada activa: cuenta atrás (si la hay) y paso manual a la
          principal con confirmación. */}
      {intro?.active && (
        <div className="rounded bg-black/30 px-3 py-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              🎬 Escena de entrada{intro.state?.collection ? ` · ${THEMES[intro.state.collection]?.label ?? intro.state.collection}` : ''}
            </span>
            {intro.remainingMs != null && !intro.expired ? (
              <span className="text-sm tabular-nums">
                Escena principal en <span className="font-bold">{mmss(intro.remainingMs)}</span>
                <span className="opacity-50">{intro.state?.autoSwitch ? ' · automático' : ' · manual'}</span>
              </span>
            ) : intro.expired && intro.graceRemainingMs != null ? (
              <span className="text-sm tabular-nums">
                ¡EMPEZAMOS! · escena principal en <span className="font-bold">{mmss(intro.graceRemainingMs)}</span>
              </span>
            ) : intro.expired ? (
              <span className="text-sm opacity-60">cuenta atrás finalizada</span>
            ) : null}
          </div>

          {!confirmMain ? (
            <button
              onClick={() => setConfirmMain(true)}
              className="self-start rounded px-3 py-1.5 text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 transition"
            >
              Pasar a la escena principal ahora
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">
                {intro.remainingMs != null && !intro.expired
                  ? `Aún quedan ${mmss(intro.remainingMs)}. ¿Pasar ya a la escena principal?`
                  : '¿Pasar a la escena principal?'}
              </span>
              <button
                onClick={() => { intro.goToMain(); setConfirmMain(false); notify('🎬 Escena principal activada'); }}
                className="rounded px-3 py-1.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 transition"
              >
                Sí, pasar
              </button>
              <button
                onClick={() => setConfirmMain(false)}
                className="rounded px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 transition"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {toast && <div className="text-sm">{toast}</div>}

      {showSetup && (
        <BroadcastSetupModal onClose={() => setShowSetup(false)} onStarted={onStarted} intro={intro} />
      )}
    </div>
  );
}

// Editor del título y la categoría/juego del directo (Helix Modify Channel
// Information). El juego se elige con autocompletado contra la búsqueda de Twitch.
export function StreamPanel({ presentCount, intro }) {
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
      <BroadcastPanel presentCount={presentCount} intro={intro} />

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
