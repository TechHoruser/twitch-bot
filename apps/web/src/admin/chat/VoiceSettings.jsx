'use client';
import { useState } from 'react';

// Etiqueta legible para un fichero de voz de Piper (es_ES-davefx-medium.onnx → davefx · es_ES · medium).
const piperLabel = (file) => {
  const m = file.replace(/\.onnx$/, '').match(/^([a-z]{2}_[A-Z]{2})-(.+)-([^-]+)$/);
  return m ? `${m[2]} · ${m[1]} · ${m[3]}` : file;
};

// Ajustes de los avisos de voz privados (TTS) del panel. Plegable; el estado vive
// en useVoiceAlerts (persistido en localStorage).
export function VoiceSettings({ voice }) {
  const [open, setOpen] = useState(false);
  const { settings, setSettings, voices, devices, piper, refreshDevices } = voice;
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const usingPiper = settings.engine === 'piper';

  return (
    <div className="border-b border-white/10">
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs opacity-80 hover:opacity-100"
        onClick={() => setOpen((o) => !o)}
      >
        <span>🔈 Voz {settings.enabled ? (settings.readChat ? '· lee el chat' : '· avisos') : '· off'} {settings.enabled && `· ${usingPiper ? 'natural' : 'navegador'}`}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            Activar avisos de voz (privado, no se emite al directo)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.readChat} onChange={(e) => set({ readChat: e.target.checked })} disabled={!settings.enabled} />
            Leer en voz todos los mensajes del chat
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.chime} onChange={(e) => set({ chime: e.target.checked })} disabled={!settings.enabled} />
            Sonido (chime) antes de los avisos
          </label>

          {/* Motor de voz: natural (Piper) vs navegador. */}
          <label className="flex items-center gap-2">
            <span className="w-16 opacity-70">Motor</span>
            <select value={settings.engine} onChange={(e) => set({ engine: e.target.value })}
              className="flex-1 bg-white/10 rounded px-1 py-0.5" disabled={!settings.enabled}>
              <option value="piper">Voz natural (Piper){piper?.configured ? '' : ' — sin instalar'}</option>
              <option value="browser">Navegador (síntesis básica)</option>
            </select>
          </label>

          {usingPiper && !piper?.configured && (
            <p className="text-amber-400/80 leading-snug">
              La voz natural no está instalada. Ejecuta <code className="bg-white/10 px-1 rounded">npm run setup:tts</code> y
              reinicia la web. Mientras tanto se usa la voz del navegador.
            </p>
          )}

          <label className="flex items-center gap-2">
            <span className="w-16 opacity-70">Volumen</span>
            <input type="range" min="0" max="1" step="0.05" value={settings.volume}
              onChange={(e) => set({ volume: Number(e.target.value) })} className="flex-1" />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 opacity-70">Velocidad</span>
            <input type="range" min="0.5" max="1.6" step="0.05" value={settings.rate}
              onChange={(e) => set({ rate: Number(e.target.value) })} className="flex-1" />
          </label>

          {/* Selector de voz: Piper (si hay varias descargadas) o navegador. */}
          {usingPiper ? (
            piper?.voices?.length > 0 && (
              <label className="flex items-center gap-2">
                <span className="w-16 opacity-70">Voz</span>
                <select value={settings.piperVoice || piper.current} onChange={(e) => set({ piperVoice: e.target.value })}
                  className="flex-1 bg-white/10 rounded px-1 py-0.5">
                  {piper.voices.map((f) => <option key={f} value={f}>{piperLabel(f)}</option>)}
                </select>
              </label>
            )
          ) : (
            <label className="flex items-center gap-2">
              <span className="w-16 opacity-70">Voz</span>
              <select value={settings.voiceURI} onChange={(e) => set({ voiceURI: e.target.value })}
                className="flex-1 bg-white/10 rounded px-1 py-0.5">
                <option value="">Automática (español si hay)</option>
                {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
              </select>
            </label>
          )}

          <div className="flex items-center gap-2">
            <span className="w-16 opacity-70 shrink-0">Salida</span>
            <select value={settings.deviceId} onChange={(e) => set({ deviceId: e.target.value })}
              className="flex-1 bg-white/10 rounded px-1 py-0.5">
              <option value="">Dispositivo por defecto</option>
              {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Salida ${i + 1}`}</option>)}
            </select>
            <button className="bg-white/10 hover:bg-white/20 rounded px-2 py-0.5" onClick={refreshDevices}>🎧</button>
          </div>

          <p className="opacity-50 leading-snug">
            {usingPiper
              ? 'Con la voz natural, el chime y la voz salen por el dispositivo elegido, así que nada se captura en el directo.'
              : 'El chime se envía al dispositivo elegido. La voz del navegador sigue la salida del sistema: para que tampoco se capture, enruta el audio del navegador a ese mismo dispositivo (Voicemeeter / cable virtual).'}
          </p>
        </div>
      )}
    </div>
  );
}
