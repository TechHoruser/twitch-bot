'use client';
import { useEffect, useRef, useState } from 'react';

// Parser mínimo de IRC de Twitch (tags + prefijo + comando + parámetros).
const parseTags = (raw) => {
  const tags = {};
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    tags[p.slice(0, i)] = p.slice(i + 1);
  });
  return tags;
};

const parseLine = (line) => {
  let rest = line;
  let tags = {};
  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ');
    tags = parseTags(rest.slice(1, sp));
    rest = rest.slice(sp + 1);
  }
  let prefix = '';
  if (rest.startsWith(':')) {
    const sp = rest.indexOf(' ');
    prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }
  const sp = rest.indexOf(' ');
  const command = sp === -1 ? rest : rest.slice(0, sp);
  const params = sp === -1 ? '' : rest.slice(sp + 1);
  return { tags, prefix, command, params };
};

// Conecta al chat de Twitch en modo lectura anónima (justinfan) y mantiene los
// últimos mensajes. No requiere token: el token solo se usa para moderar (API).
export function useTwitchChat(channel) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('connecting');
  const wsRef = useRef(null);

  useEffect(() => {
    if (!channel) { setStatus('no-channel'); return; }

    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('PASS SCHMOOPIIE');
      ws.send('NICK justinfan' + Math.floor(Math.random() * 99999));
      ws.send('JOIN #' + channel.toLowerCase());
      setStatus('connected');
    };

    ws.onmessage = (ev) => {
      ev.data.split('\r\n').filter(Boolean).forEach((line) => {
        if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); return; }
        const { tags, prefix, command, params } = parseLine(line);

        if (command === 'PRIVMSG') {
          const text = params.slice(params.indexOf(':') + 1);
          const login = prefix.split('!')[0];
          setMessages((prev) => [...prev.slice(-199), {
            id: tags.id,
            userId: tags['user-id'],
            login,
            name: tags['display-name'] || login,
            color: tags.color || '#b6a8e0',
            badges: tags.badges || '',
            mod: tags.mod === '1',
            text,
            ts: Date.now(),
            removed: false,
          }]);
        } else if (command === 'CLEARMSG') {
          const target = tags['target-msg-id'];
          setMessages((prev) => prev.map((m) => (m.id === target ? { ...m, removed: true } : m)));
        } else if (command === 'CLEARCHAT') {
          const targetId = tags['target-user-id'];
          setMessages((prev) => prev.map((m) => (targetId && m.userId === targetId ? { ...m, removed: true } : m)));
        }
      });
    };

    ws.onclose = () => setStatus('closed');
    ws.onerror = () => setStatus('error');

    return () => ws.close();
  }, [channel]);

  return { messages, status };
}
