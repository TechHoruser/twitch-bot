'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Avisos de voz PRIVADOS del streamer (no van al overlay, así no se capturan en el
// directo): anuncia el nombre en primer mensaje / nuevo follow y, opcionalmente,
// lee el chat. Usa la síntesis de voz del navegador (speechSynthesis): gratis, sin
// claves y offline.
//
// Nota de enrutado: speechSynthesis no permite elegir dispositivo por API; el
// "chime" (WebAudio) sí, vía setSinkId. Para que también la VOZ quede fuera del
// directo, enruta la salida de audio del navegador (Voicemeeter / cable virtual)
// al mismo dispositivo elegido aquí.

const STORE_KEY = 'voiceAlerts';
const DEFAULTS = { enabled: true, readChat: false, chime: true, volume: 1, rate: 1, voiceURI: '', deviceId: '' };

const load = () => {
  if (typeof window === 'undefined') return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
  catch { return DEFAULTS; }
};

export function useVoiceAlerts() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [voices, setVoices] = useState([]);
  const [devices, setDevices] = useState([]);
  const settingsRef = useRef(settings);
  const ctxRef = useRef(null);

  // Carga inicial desde localStorage (solo en cliente, para no romper SSR).
  useEffect(() => { setSettings(load()); }, []);
  useEffect(() => {
    settingsRef.current = settings;
    if (typeof window !== 'undefined') localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Voces disponibles (se cargan de forma asíncrona en algunos navegadores).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
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

  const pickVoice = () => {
    const all = window.speechSynthesis?.getVoices() || [];
    return all.find((v) => v.voiceURI === settingsRef.current.voiceURI)
      || all.find((v) => v.lang?.toLowerCase().startsWith('es'))
      || all[0];
  };

  const speak = useCallback((text) => {
    const s = settingsRef.current;
    if (!s.enabled || !text || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.volume = s.volume;
    u.rate = s.rate;
    window.speechSynthesis.speak(u); // speechSynthesis ya encola las locuciones
  }, []);

  // Chime corto (WebAudio) enrutable al dispositivo elegido (setSinkId).
  const chime = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.enabled || !s.chime || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctxRef.current) ctxRef.current = new AC();
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    if (s.deviceId && ctx.setSinkId) { try { await ctx.setSinkId(s.deviceId); } catch { /* no soportado */ } }
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
  }, []);

  const announceFirstMessage = useCallback((name) => { chime(); speak(`Primer mensaje de ${name}`); }, [chime, speak]);
  const announceFollow = useCallback((name) => { chime(); speak(`${name} se ha unido a tu canal`); }, [chime, speak]);
  const readMessage = useCallback((name, text) => { if (settingsRef.current.readChat) speak(`${name} dice: ${text}`); }, [speak]);

  return {
    settings, setSettings, voices, devices, refreshDevices,
    announceFirstMessage, announceFollow, readMessage,
  };
}
