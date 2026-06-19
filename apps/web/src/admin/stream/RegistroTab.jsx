'use client';
import { useEffect, useMemo, useState } from 'react';

const fmtTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (ts) => new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDur = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

// A partir de los eventos join/part construye, por usuario, los intervalos en los
// que estuvo presente. Un join sin part posterior se considera abierto hasta el
// final del rango (fin del directo o ahora).
function buildUsers(events, rangeEnd) {
  const byUser = new Map();
  for (const e of events) {
    if (!byUser.has(e.login)) byUser.set(e.login, { login: e.login, name: e.name, events: [] });
    byUser.get(e.login).events.push(e);
  }
  const users = [];
  for (const u of byUser.values()) {
    const intervals = [];
    let open = null;
    for (const e of u.events) {
      const t = new Date(e.ts).getTime();
      if (e.type === 'join') { if (open === null) open = t; }
      else if (open !== null) { intervals.push([open, t]); open = null; }
    }
    if (open !== null) intervals.push([open, rangeEnd]);
    const total = intervals.reduce((acc, [s, e]) => acc + (e - s), 0);
    const first = intervals.length ? intervals[0][0] : Infinity;
    users.push({ ...u, intervals, total, first });
  }
  // Quien antes entró, arriba.
  users.sort((a, b) => a.first - b.first);
  return users;
}

// Línea de tiempo (estilo Gantt) de la presencia de un directo: una fila por
// usuario y barras por cada tramo en el que estuvo en el chat.
function Timeline({ session, events }) {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  // Asegura que el rango cubre todos los eventos aunque haya algún desfase.
  const rangeStart = Math.min(start, ...events.map((e) => new Date(e.ts).getTime()), end);
  const rangeEnd = Math.max(end, ...events.map((e) => new Date(e.ts).getTime()), rangeStart + 60000);
  const span = Math.max(1, rangeEnd - rangeStart);

  const users = useMemo(() => buildUsers(events, rangeEnd), [events, rangeEnd]);
  const pct = (t) => `${((t - rangeStart) / span) * 100}%`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => rangeStart + span * f);

  if (users.length === 0) {
    return <p className="opacity-60 text-sm mt-4">Aún no hay entradas/salidas registradas en este directo.</p>;
  }

  return (
    <div className="mt-4">
      {/* Eje de tiempo */}
      <div className="relative h-5 ml-40 border-b border-white/10">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 text-[10px] opacity-50 tabular-nums"
            style={{ left: pct(t) }}
          >
            {fmtTime(t)}
          </span>
        ))}
      </div>

      {/* Filas de usuarios */}
      <div className="divide-y divide-white/5">
        {users.map((u) => (
          <div key={u.login} className="flex items-center h-7 group">
            <div className="w-40 shrink-0 pr-2 truncate text-sm" title={`${u.name} · ${fmtDur(u.total)}`}>
              {u.name}
            </div>
            <div className="relative flex-1 h-full">
              {u.intervals.map(([s, e], i) => (
                <div
                  key={i}
                  className="absolute top-1.5 h-4 rounded-sm bg-emerald-500/70 group-hover:bg-emerald-400"
                  style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})`, minWidth: '2px' }}
                  title={`${u.name}: ${fmtTime(s)} → ${fmtTime(e)} (${fmtDur(e - s)})`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pestaña "Registro": elige un directo y muestra la línea de tiempo de presencia.
export function RegistroTab() {
  const [sessions, setSessions] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadSessions = () => fetch('/api/admin/presence').then((r) => r.json()).then((res) => {
    const list = res?.sessions || [];
    setSessions(list);
    setSelected((cur) => cur ?? list[0]?.id ?? null);
  });

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setLoadingDetail(true);
    fetch(`/api/admin/presence?session=${selected}`)
      .then((r) => r.json())
      .then((res) => setDetail(res?.ok ? res : null))
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  if (sessions === null) return <p className="opacity-60">Cargando registro…</p>;
  if (sessions.length === 0) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold mb-2">🗒️ Registro de directos</h2>
        <p className="opacity-60 text-sm">
          Todavía no hay directos registrados. Se crea uno automáticamente cuando alguien entra
          al chat, o al pulsar <span className="font-semibold">Iniciar retransmisión</span> en la pestaña Directo.
        </p>
      </div>
    );
  }

  const current = sessions.find((s) => s.id === selected);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">🗒️ Registro de directos</h2>
        <div className="flex items-center gap-2">
          <select
            value={selected || ''}
            onChange={(e) => setSelected(e.target.value)}
            className="bg-white/10 rounded px-3 py-1.5 text-sm max-w-xs"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id} className="bg-neutral-800">
                {fmtDateTime(s.startedAt)} · {s.title} {s.endedAt ? '' : '(en directo)'}
              </option>
            ))}
          </select>
          <button onClick={loadSessions} className="bg-white/10 hover:bg-white/20 rounded px-3 py-1.5 text-sm" title="Refrescar">
            ↻
          </button>
        </div>
      </div>

      {current && (
        <div className="flex gap-4 mt-3 text-sm opacity-80">
          <span>👥 {current.uniqueUsers} usuarios</span>
          <span>👁️ pico {current.peakViewers ?? 0} espectadores</span>
          <span>
            ⏱️ {fmtTime(current.startedAt)}
            {current.endedAt ? ` → ${fmtTime(current.endedAt)}` : ' → en directo'}
          </span>
        </div>
      )}

      {loadingDetail && <p className="opacity-60 mt-4">Cargando línea de tiempo…</p>}
      {!loadingDetail && detail && <Timeline session={detail.session} events={detail.events} />}
    </div>
  );
}
