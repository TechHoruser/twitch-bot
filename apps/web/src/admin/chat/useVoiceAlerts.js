'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Avisos de voz PRIVADOS del streamer (no van al overlay, así no se capturan en el
// directo): anuncia el nombre en primer mensaje / nuevo follow y, opcionalmente,
// lee el chat.
//
// Dos motores de voz, elegibles en los ajustes:
//   · 'piper'   → voz natural local (npm run setup:tts). El audio se pide a
//                 /api/admin/tts y se reproduce por WebAudio, así que se puede
//                 enrutar al dispositivo elegido (setSinkId) igual que el chime:
//                 la voz TAMBIÉN queda fuera del directo sin tocar el audio del SO.
//   · 'browser' → síntesis del navegador (speechSynthesis): gratis y sin setup,
//                 pero más robótica y NO enrutable (sigue la salida del sistema).
//
// Si el motor es 'piper' pero no está configurado o falla, cae automáticamente al
// navegador para no quedarse mudo.

const STORE_KEY = 'voiceAlerts';
const DEFAULTS = {
  enabled: true, readChat: false, chime: true, volume: 1, rate: 1,
  engine: 'piper', voiceURI: '', piperVoice: '', deviceId: '',
};

const load = () => {
  if (typeof window === 'undefined') return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
  catch { return DEFAULTS; }
};

export function useVoiceAlerts() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [voices, setVoices] = useState([]);               // voces del navegador
  const [devices, setDevices] = useState([]);             // salidas de audio
  const [piper, setPiper] = useState({ configured: false, voices: [], current: '' });
  const settingsRef = useRef(settings);
  const ctxRef = useRef(null);
  const queueRef = useRef([]);     // textos pendientes de leer
  const playingRef = useRef(false);

  // Carga inicial desde localStorage (solo en cliente, para no romper SSR).
  useEffect(() => { setSettings(load()); }, []);
  useEffect(() => {
    settingsRef.current = settings;
    if (typeof window !== 'undefined') localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Voces del navegador (se cargan de forma asíncrona en algunos navegadores).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, []);

  // Estado de la voz natural (Piper): si está configurada y qué voces hay descargadas.
  useEffect(() => {
    fetch('/api/admin/tts')
      .then((r) => r.json())
      .then((d) => { if (d) setPiper({ configured: !!d.configured, voices: d.voices || [], current: d.current || '' }); })
      .catch(() => { /* sin servidor: se queda en navegador */ });
  }, []);

  // Lista de salidas de audio. Las etiquetas solo aparecen tras conceder permiso
  // de audio; refreshDevices() lo pide explícitamente.
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); }
    catch { /* sin permiso: se listarán sin etiqueta */ }
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list.filter((d) => d.kind === 'audiooutput'));
  }, []);

  // AudioContext compartido (chime + voz Piper), con resume y enrutado al dispositivo.
  const ensureCtx = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef.current) ctxRef.current = new AC();
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* gesto pendiente */ } }
    const dev = settingsRef.current.deviceId;
    if (dev && ctx.setSinkId) { try { await ctx.setSinkId(dev); } catch { /* no soportado */ } }
    return ctx;
  }, []);

  const pickBrowserVoice = () => {
    const all = window.speechSynthesis?.getVoices() || [];
    return all.find((v) => v.voiceURI === settingsRef.current.voiceURI)
      || all.find((v) => v.lang?.toLowerCase().startsWith('es'))
      || all[0];
  };

  // Reproduce un WAV (ArrayBuffer) por WebAudio; resuelve al terminar.
  const playBuffer = useCallback(async (arrayBuffer, volume) => {
    const ctx = await ensureCtx();
    if (!ctx) return;
    const audioBuf = await ctx.decodeAudioData(arrayBuffer);
    await new Promise((resolve) => {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.buffer = audioBuf;
      src.connect(gain).connect(ctx.destination);
      src.onended = resolve;
      src.start();
    });
  }, [ensureCtx]);

  // Voz del navegador (fallback / motor 'browser'); resuelve al terminar.
  const speakBrowser = (text, s) => new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickBrowserVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    u.volume = s.volume;
    u.rate = s.rate;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.speak(u);
  });

  // Voz natural (Piper) vía la ruta de servidor; lanza si no está disponible.
  const speakPiper = async (text, s) => {
    const res = await fetch('/api/admin/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, rate: s.rate, voice: s.piperVoice || undefined }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    await playBuffer(await res.arrayBuffer(), s.volume);
  };

  // Procesa la cola de locuciones en serie (una detrás de otra, sin solaparse).
  const processQueue = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    try {
      while (queueRef.current.length) {
        const text = queueRef.current.shift();
        const s = settingsRef.current;
        if (s.engine === 'piper') {
          try { await speakPiper(text, s); }
          catch { await speakBrowser(text, s); } // fallback si Piper no está disponible
        } else {
          await speakBrowser(text, s);
        }
      }
    } finally {
      playingRef.current = false;
    }
  }, [playBuffer]);

  const speak = useCallback((text) => {
    const s = settingsRef.current;
    if (!s.enabled || !text) return;
    queueRef.current.push(text);
    processQueue();
  }, [processQueue]);

  // Chime corto (WebAudio) enrutable al dispositivo elegido.
  const chime = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.enabled || !s.chime) return;
    const ctx = await ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const t = now + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.25 * s.volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }, [ensureCtx]);

  const announceFirstMessage = useCallback((name) => { chime(); speak(`Primer mensaje de ${name}`); }, [chime, speak]);
  const announceFollow = useCallback((name) => { chime(); speak(`${name} se ha unido a tu canal`); }, [chime, speak]);
  const readMessage = useCallback((name, text) => { if (settingsRef.current.readChat) speak(`${name} dice: ${text}`); }, [speak]);

  return {
    settings, setSettings, voices, devices, piper, refreshDevices,
    announceFirstMessage, announceFollow, readMessage,
  };
}
