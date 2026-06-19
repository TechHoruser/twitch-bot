'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Sondea el estado del directo (espectadores, si está en vivo, estado de OBS) cada
// pocos segundos para la pestaña "Directo".
const POLL_MS = 15000;

export function useStreamStatus({ enabled = true, intervalMs = POLL_MS } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stream/status').then((r) => r.json());
      setData(res);
    } catch (e) {
      setData({ ok: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    timerRef.current = setInterval(refresh, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [enabled, intervalMs, refresh]);

  return { data, loading, refresh };
}
