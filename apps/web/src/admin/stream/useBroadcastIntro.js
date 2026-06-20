'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTDOWN_MINUTES } from '../../scenes/config';
import { applyPreset } from '../audio/sceneAudio';

// Gestiona la "escena de entrada" del directo: al iniciar la retransmisión se
// precarga la pantalla intro de la colección elegida (con su cuenta atrás) y, si
// se marcó la opción, pasa automáticamente a la pantalla principal (juego) cuando
// la cuenta atrás llega a cero. El estado se guarda en localStorage para sobrevivir
// a recargas, y el hook se monta en <Admin> (siempre presente) para que el cambio
// automático ocurra aunque no se esté viendo la pestaña Directo.
const KEY = 'broadcastIntro';

const setSceneApi = (partial) => fetch('/api/admin/scene', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(partial),
}).catch(() => {});

const load = () => {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
};

export function useBroadcastIntro() {
  const [state, setState] = useState(null); // { collection, autoSwitch, startedAt, endsAt|null }
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => { setState(load()); }, []);

  // Tic mientras hay una intro activa (para refrescar la cuenta atrás y disparar
  // el auto-cambio).
  useEffect(() => {
    if (!state) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state]);

  const persist = useCallback((s) => {
    if (typeof window !== 'undefined') {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    }
    setState(s);
  }, []);

  // Pasa a la pantalla principal (juego) y cierra la intro, aplicando el preset de
  // audio de la escena principal de la colección.
  const goToMain = useCallback(() => {
    firedRef.current = true;
    const collection = state?.collection;
    setSceneApi({ screen: 'game' });
    if (collection) applyPreset(collection, 'game');
    persist(null);
  }, [persist, state]);

  // Arranca la intro de una colección. autoSwitch sólo aplica si hay cuenta atrás.
  // Se calcula un único endsAt y se envía tanto a la escena (lo lee el overlay por
  // SSE) como a localStorage (lo lee este panel), de modo que ambas cuentas atrás
  // van hacia el mismo instante y muestran lo mismo.
  const start = useCallback(({ collection, autoSwitch }) => {
    firedRef.current = false;
    const hasCountdown = COUNTDOWN_MINUTES > 0;
    const startedAt = Date.now();
    const endsAt = hasCountdown ? startedAt + COUNTDOWN_MINUTES * 60000 : null;
    setSceneApi({ game: collection, screen: 'intro', countdownEndsAt: endsAt });
    applyPreset(collection, 'intro');
    persist({
      collection,
      autoSwitch: !!autoSwitch && hasCountdown,
      startedAt,
      endsAt,
    });
  }, [persist]);

  const dismiss = useCallback(() => persist(null), [persist]);

  const remainingMs = state?.endsAt ? Math.max(0, state.endsAt - now) : null;
  const expired = state?.endsAt ? now >= state.endsAt : false;

  // Auto-paso a la principal al agotarse la cuenta atrás (si se marcó la opción).
  useEffect(() => {
    if (!state || !state.autoSwitch || firedRef.current) return;
    if (state.endsAt && now >= state.endsAt) goToMain();
  }, [state, now, goToMain]);

  return {
    state,
    active: !!state,
    remainingMs,
    expired,
    hasCountdown: COUNTDOWN_MINUTES > 0,
    start,
    goToMain,
    dismiss,
  };
}
