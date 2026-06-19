'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_DB = -60;
const MAX_DB = 0;

const post = (body) => fetch('/api/audio', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function AudioPanel() {
  const [state, setState] = useState({ loading: true });
  const dragging = useRef(false);
  const writing = useRef(0); // escrituras en vuelo: mientras >0 no pisamos el estado con polls
  const epoch = useRef(0);   // sube con cada cambio local para descartar polls obsoletos

  const load = useCallback(async () => {
    if (writing.current > 0 || dragging.current) return;
    const myEpoch = epoch.current;
    const d = await fetch('/api/audio').then((r) => r.json());
    // Si el usuario tocó algo mientras la petición estaba en vuelo, descartamos la
    // respuesta para no revertir el cambio optimista con datos antiguos de OBS.
    if (writing.current > 0 || dragging.current || epoch.current !== myEpoch) return;
    setState(d);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [load]);

  // Aplica el cambio de forma optimista y lo escribe en OBS, bloqueando el polling
  // hasta que OBS lo confirma para que ambos lados no se desincronicen.
  const mutate = useCallback(async (body, patch) => {
    epoch.current += 1;
    writing.current += 1;
    setState((s) => ({ ...s, inputs: s.inputs.map((i) => (i.name === body.input ? { ...i, ...patch } : i)) }));
    try {
      await post(body);
    } finally {
      writing.current -= 1;
    }
  }, []);

  const onVol = (name, db) => mutate({ action: 'volume', input: name, value: db }, { volumeDb: db });
  const onMute = (name, muted) => mutate({ action: 'mute', input: name, value: !muted }, { muted: !muted });
  const onMonitor = (name, monitoring) => mutate({ action: 'monitor', input: name, value: !monitoring }, { monitoring: !monitoring });

  if (state.loading) return <p className="opacity-60 text-sm">Cargando…</p>;

  if (!state.ok) {
    return (
      <div className="text-sm opacity-80 space-y-2">
        <h2 className="text-lg font-semibold opacity-100">Audio (mezclador de OBS)</h2>
        <p>No se pudo conectar con OBS{state.error ? ` (${state.error})` : ''}.</p>
        <p>Abre OBS, activa <b>Herramientas ▸ obs-websocket Server Settings</b>, y pon
          <code className="bg-white/10 px-1 rounded mx-1">OBS_WEBSOCKET_URL</code> /
          <code className="bg-white/10 px-1 rounded mx-1">OBS_WEBSOCKET_PASSWORD</code> en
          <code className="bg-white/10 px-1 rounded mx-1">apps/web/.env.local</code>.</p>
        <p>Ejecuta <code className="bg-white/10 px-1 rounded">npm run setup:audio</code> para crear las fuentes de los VB-Cable.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Audio (mezclador de OBS)</h2>
      {state.inputs.length === 0 && (
        <p className="text-sm opacity-60">OBS no tiene fuentes de audio. Ejecuta <code className="bg-white/10 px-1 rounded">npm run setup:audio</code>.</p>
      )}
      {state.inputs.map((inp) => (
        <div key={inp.name} className="flex items-center gap-3 bg-white/5 rounded px-3 py-2">
          <button onClick={() => onMute(inp.name, inp.muted)} className={`w-9 h-9 rounded shrink-0 ${inp.muted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
            {inp.muted ? '🔇' : '🔊'}
          </button>
          <span className="w-36 truncate text-sm shrink-0">{inp.name}</span>
          <input
            type="range" min={MIN_DB} max={MAX_DB} step="1"
            value={Math.max(MIN_DB, Math.round(inp.volumeDb))}
            className="flex-1"
            onMouseDown={() => { dragging.current = true; }}
            onMouseUp={() => { dragging.current = false; }}
            onChange={(e) => onVol(inp.name, Number(e.target.value))}
          />
          <span className="w-14 text-right text-xs opacity-70 shrink-0">{Math.round(inp.volumeDb)} dB</span>
          <button
            onClick={() => onMonitor(inp.name, inp.monitoring)}
            title={inp.monitoring ? 'Desactivar monitorización en OBS' : 'Activar monitorización en OBS'}
            className={`w-9 h-9 rounded shrink-0 text-base ${inp.monitoring ? 'bg-green-500 hover:bg-green-600' : 'bg-white/10 hover:bg-white/20'}`}
          >
            🎧
          </button>
        </div>
      ))}
    </div>
  );
}
