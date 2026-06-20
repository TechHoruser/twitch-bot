'use client';
import { useEffect, useRef, useState } from 'react';

// Escucha quién entra (JOIN) y sale (PART) del chat de Twitch para alimentar el
// registro de presencia por directo. Usa una conexión IRC anónima (justinfan) con
// la capacidad `twitch.tv/membership`, que es la que entrega JOIN/PART y la lista
// inicial de usuarios (NAMES, código 353). Los eventos se mandan al backend en
// tandas para no saturar (Twitch los envía en ráfagas).
//
// Nota: Twitch sólo emite JOIN/PART de forma fiable en canales pequeños y con
// cierto retardo; es la limitación propia del IRC de Twitch, no del panel.
const FLUSH_MS = 4000;

export function usePresence(channel) {
  const [present, setPresent] = useState(() => new Set());
  const [status, setStatus] = useState('connecting');
  const bufferRef = useRef([]); // eventos pendientes de enviar
  const presentRef = useRef(new Set());

  useEffect(() => {
    if (!channel) { setStatus('no-channel'); return; }

    const chan = channel.toLowerCase();
    presentRef.current = new Set();
    setPresent(new Set());

    const queue = (login, type) => {
      const lower = login.toLowerCase();
      if (type === 'join' && presentRef.current.has(lower)) return;
      if (type === 'part' && !presentRef.current.has(lower)) return;
      if (type === 'join') presentRef.current.add(lower);
      else presentRef.current.delete(lower);
      setPresent(new Set(presentRef.current));
      // Marca la hora real del evento (no la del envío en tanda) para que la
      // línea de tiempo del registro refleje cuándo entró/salió cada uno.
      bufferRef.current.push({ login: lower, name: login, type, ts: new Date().toISOString() });
    };

    const flush = () => {
      if (bufferRef.current.length === 0) return;
      const events = bufferRef.current;
      bufferRef.current = [];
      fetch('/api/admin/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      }).catch(() => { /* reintentará en la siguiente tanda implícitamente */ });
    };

    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/membership');
      ws.send('PASS SCHMOOPIIE');
      ws.send('NICK justinfan' + Math.floor(Math.random() * 99999));
      ws.send('JOIN #' + chan);
      setStatus('connected');
    };

    ws.onmessage = (ev) => {
      ev.data.split('\r\n').filter(Boolean).forEach((line) => {
        if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); return; }

        // JOIN: ":login!login@login.tmi.twitch.tv JOIN #canal"
        // PART: ":login!login@login.tmi.twitch.tv PART #canal"
        const m = line.match(/^:(\w+)!\w+@[\w.]+ (JOIN|PART) #/);
        if (m) { queue(m[1], m[2] === 'JOIN' ? 'join' : 'part'); return; }

        // 353 (NAMES): lista de usuarios presentes al conectar.
        //  ":...353 nick = #canal :user1 user2 user3"
        const names = line.match(/ 353 \S+ = #\S+ :(.+)$/);
        if (names) { names[1].trim().split(/\s+/).forEach((u) => u && queue(u, 'join')); }
      });
    };

    ws.onclose = () => setStatus('closed');
    ws.onerror = () => setStatus('error');

    const timer = setInterval(flush, FLUSH_MS);

    return () => {
      clearInterval(timer);
      flush();
      ws.close();
    };
  }, [channel]);

  return { present, count: present.size, status };
}
