'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStream } from '../../shared/StreamProvider';
import { GAMES, THEMES } from '../../scenes/themes';
import {
  getPreset, setSource, removeSource, applyPreset, exportPresets, importPresets,
} from './sceneAudio';

const SCREENS = [
  { key: 'intro', label: 'Intro', icon: '🔴' },
  { key: 'game', label: 'Juego', icon: '🎮' },
  { key: 'pause', label: 'Pausa', icon: '⏸' },
  { key: 'outro', label: 'Cerrando', icon: '👋' },
];

const setSceneApi = (partial) => fetch('/api/admin/scene', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(partial),
});

// dB → multiplicador lineal (por si OBS no devuelve inputVolumeMul).
const dbToMul = (db) => (db <= -100 ? 0 : 10 ** (db / 20));
const liveMul = (src) => (src.volumeMul ?? dbToMul(src.volumeDb ?? -60));
const pctOf = (mul) => Math.round(Math.max(0, Math.min(1, mul)) * 100);

// Panel combinado: control de escena (colección + pantalla) y, debajo, los niveles
// de audio de OBS guardados para esa escena (preset por colección/escena).
export function ScenesAudioPanel() {
  const { scene } = useStream();
  const collection = GAMES.includes(scene.game) ? scene.game : GAMES[0];
  const screen = scene.screen;

  const [state, setState] = useState({ loading: true });
  const [preset, setPreset] = useState({});
  const dragging = useRef(false);
  const fileRef = useRef(null);

  const refreshPreset = useCallback(() => setPreset(getPreset(collection, screen)), [collection, screen]);
  useEffect(() => { refreshPreset(); }, [refreshPreset]);

  const load = useCallback(async () => {
    if (dragging.current) return;
    const d = await fetch('/api/audio').then((r) => r.json()).catch(() => ({ ok: false }));
    if (!dragging.current) setState(d);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [load]);

  const audioPost = (body) => fetch('/api/audio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).catch(() => {});

  // Cambiar la escena activa (overlay) y aplicar su preset de audio a OBS.
  const pickCollection = (game) => { setSceneApi({ game }); applyPreset(game, screen); };
  const pickScreen = (key) => { setSceneApi({ screen: key }); applyPreset(collection, key); };

  // Editar el nivel de una fuente: la incluye en el preset de la escena y lo aplica
  // a OBS en vivo (para oír el efecto al instante).
  const onVol = (name, pct) => {
    const mul = pct / 100;
    setSource(collection, screen, name, { mul });
    refreshPreset();
    audioPost({ action: 'volumeMul', input: name, value: mul });
  };

  const onMute = (name, nextMuted) => {
    setSource(collection, screen, name, { muted: nextMuted });
    refreshPreset();
    audioPost({ action: 'mute', input: name, value: nextMuted });
  };

  const onToggleInclude = (src, included) => {
    if (included) {
      removeSource(collection, screen, src.name);
    } else {
      setSource(collection, screen, src.name, { mul: liveMul(src), muted: src.muted });
      audioPost({ action: 'volumeMul', input: src.name, value: liveMul(src) });
    }
    refreshPreset();
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(exportPresets(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene-audio-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      importPresets(data);
      refreshPreset();
    } catch {
      // JSON inválido: ignoramos en silencio (el input se resetea abajo).
    }
    e.target.value = '';
  };

  const sources = state.ok ? (state.inputs || []) : [];
  const configuredCount = Object.keys(preset).length;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Control de escena: colección (selector) + pantallas (cuadrados) */}
      <div className="rounded-lg p-4 bg-white/5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Escena</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={collection}
            onChange={(e) => pickCollection(e.target.value)}
            className="bg-white/10 rounded px-3 py-2 text-sm"
          >
            {GAMES.map((g) => (
              <option key={g} value={g} className="bg-neutral-800">{THEMES[g].label}</option>
            ))}
          </select>

          <div className="flex gap-2">
            {SCREENS.map((s) => (
              <button
                key={s.key}
                onClick={() => pickScreen(s.key)}
                title={s.label}
                className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center text-xs gap-0.5 transition ${
                  screen === s.key ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
                }`}
              >
                <span className="text-lg leading-none">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Audio de la escena seleccionada */}
      <div className="rounded-lg p-4 bg-white/5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">
            🎚️ Audio · {THEMES[collection]?.label} / {SCREENS.find((s) => s.key === screen)?.label ?? screen}
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => applyPreset(collection, screen)}
              disabled={configuredCount === 0}
              className="rounded px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 transition"
              title="Aplicar a OBS los niveles guardados de esta escena"
            >
              Aplicar a OBS
            </button>
            <button onClick={onExport} className="rounded px-3 py-1.5 bg-white/10 hover:bg-white/20 transition">Exportar</button>
            <button onClick={() => fileRef.current?.click()} className="rounded px-3 py-1.5 bg-white/10 hover:bg-white/20 transition">Importar</button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
          </div>
        </div>

        <p className="text-xs opacity-50 -mt-1">
          Marca las fuentes que esta escena debe fijar y ajusta su nivel (0–100%). Sólo se
          guardan y aplican las marcadas; al activar la escena se aplican a OBS automáticamente.
        </p>

        {state.loading && <p className="text-sm opacity-60">Cargando audio…</p>}

        {!state.loading && !state.ok && (
          <p className="text-sm opacity-80">
            No se pudo conectar con OBS{state.error ? ` (${state.error})` : ''}. Abre OBS con
            obs-websocket y configura <code className="bg-white/10 px-1 rounded">OBS_WEBSOCKET_URL</code>.
          </p>
        )}

        {state.ok && sources.length === 0 && (
          <p className="text-sm opacity-60">OBS no tiene fuentes de audio.</p>
        )}

        {sources.map((src) => {
          const cfg = preset[src.name];
          const included = !!cfg;
          const pct = included ? pctOf(cfg.mul) : pctOf(liveMul(src));
          const muted = included ? !!cfg.muted : src.muted;
          return (
            <div
              key={src.name}
              className={`flex items-center gap-3 rounded px-3 py-2 ${included ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-white/5'}`}
            >
              <button
                onClick={() => onMute(src.name, !muted)}
                className={`w-9 h-9 rounded shrink-0 ${muted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
                title={muted ? 'Activar sonido' : 'Silenciar'}
              >
                {muted ? '🔇' : '🔊'}
              </button>
              <span className="w-36 truncate text-sm shrink-0" title={src.name}>{src.name}</span>
              <input
                type="range" min={0} max={100} step={1}
                value={muted ? 0 : pct}
                disabled={muted}
                className="flex-1"
                onMouseDown={() => { dragging.current = true; }}
                onMouseUp={() => { dragging.current = false; }}
                onChange={(e) => onVol(src.name, Number(e.target.value))}
              />
              <span className="w-12 text-right text-xs opacity-70 shrink-0">{muted ? '—' : `${pct}%`}</span>
              <label className="flex items-center gap-1 text-xs shrink-0 cursor-pointer" title="Guardar esta fuente en la escena">
                <input type="checkbox" checked={included} onChange={() => onToggleInclude(src, included)} />
                en escena
              </label>
            </div>
          );
        })}

        {configuredCount > 0 && (
          <p className="text-xs opacity-50">{configuredCount} fuente(s) guardada(s) para esta escena.</p>
        )}
      </div>
    </div>
  );
}
