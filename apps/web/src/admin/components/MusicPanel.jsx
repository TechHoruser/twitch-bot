'use client';
import { useState, useEffect, useRef } from 'react';
import { useStream } from '../../shared/StreamProvider';
import { useMusicAudioCtx } from '../music/MusicAudioContext';

const post = (body) => fetch('/api/music', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const ctrlBtn = 'bg-white/10 hover:bg-white/20 text-white rounded w-12 h-10 text-lg';

const PRESETS_KEY = 'music-volume-presets';
const loadPresets = () => {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]'); }
  catch { return []; }
};
const savePresets = (p) => localStorage.setItem(PRESETS_KEY, JSON.stringify(p));

const fmt = (s) => {
  if (!s || isNaN(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

export const MusicPanel = () => {
  const { music } = useStream();
  const { currentTime, seek } = useMusicAudioCtx();
  const playlists = music?.playlists ?? [];
  const track = music?.track;
  const playing = !!music?.playing;
  const volume100 = Math.round((music?.volume ?? 0.6) * 100);
  const duration = track?.duration ?? 0;

  const [localVol, setLocalVol] = useState(volume100);
  const [presets, setPresets] = useState([]);
  const isFocused = useRef(false);

  useEffect(() => { if (!isFocused.current) setLocalVol(volume100); }, [volume100]);
  useEffect(() => { setPresets(loadPresets()); }, []);

  const applyVolume = (raw) => {
    const v = Math.min(100, Math.max(1, Math.round(Number(raw)))) || 1;
    setLocalVol(v);
    post({ action: 'volume', value: v / 100 });
  };

  const memorize = () => {
    const next = [...new Set([...presets, localVol])].sort((a, b) => a - b);
    setPresets(next);
    savePresets(next);
  };

  const removePreset = (v) => {
    const next = presets.filter((p) => p !== v);
    setPresets(next);
    savePresets(next);
  };

  const handleSeek = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - rect.left) / rect.width) * duration);
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg p-4 bg-white/5 w-full">
      <h2 className="text-lg font-semibold">Música</h2>

      {playlists.length === 0 ? (
        <p className="text-sm opacity-60 text-center">
          No hay música todavía. Ejecuta <code className="bg-white/10 px-1 rounded">npm run setup:music</code>.
        </p>
      ) : (
        <>
          <select
            className="bg-neutral-800 text-white rounded px-3 py-2 w-full"
            value={music?.playlist ?? ''}
            onChange={(e) => post({ action: 'playlist', value: e.target.value })}
          >
            {playlists.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="text-center text-sm min-h-[2.5rem] flex flex-col justify-center">
            {track ? (
              <>
                <span className="font-bold">{track.title}</span>
                <span className="opacity-70">{track.artist}</span>
              </>
            ) : <span className="opacity-50">—</span>}
          </div>

          <div className="flex gap-2 items-center">
            <button className={ctrlBtn} onClick={() => post({ action: 'prev' })}>⏮</button>
            <button className={ctrlBtn} onClick={() => post({ action: 'toggle' })}>{playing ? '⏸' : '▶'}</button>
            <button className={ctrlBtn} onClick={() => post({ action: 'next' })}>⏭</button>
          </div>

          {/* Progreso */}
          <div className="w-full flex flex-col gap-1">
            <div
              className="w-full h-2 bg-white/20 rounded-full cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-emerald-400 rounded-full group-hover:bg-emerald-300 transition-colors"
                style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Volumen */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs opacity-60">🔈</span>
            <input
              type="number" min="1" max="100" value={localVol}
              className="w-16 bg-neutral-800 text-white rounded px-2 py-1.5 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              onFocus={() => { isFocused.current = true; }}
              onChange={(e) => setLocalVol(e.target.value)}
              onBlur={(e) => { isFocused.current = false; applyVolume(e.target.value); }}
              onKeyDown={(e) => e.key === 'Enter' && applyVolume(localVol)}
            />
            <button
              onClick={memorize}
              className="text-xs px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition"
            >Memorizar</button>
          </div>

          {/* Presets memorizados */}
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 w-full">
              {presets.map((v) => (
                <div key={v} className="flex items-stretch rounded overflow-hidden">
                  <button
                    onClick={() => applyVolume(v)}
                    className={`px-3 py-1 text-xs font-semibold transition ${
                      v === volume100
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >{v}</button>
                  <button
                    onClick={() => removePreset(v)}
                    className="px-1.5 text-xs bg-white/5 hover:bg-red-500/60 text-white/40 hover:text-white transition"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
