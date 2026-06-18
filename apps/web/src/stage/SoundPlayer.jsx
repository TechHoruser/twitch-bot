'use client';
import { useEffect, useRef } from 'react';
import { useStream } from '../shared/StreamProvider';

// Reproduce los efectos disparados desde /admin. Ignora el estado inicial recibido
// al conectar (solo reproduce cuando el nonce cambia).
export default function SoundPlayer() {
  const { sound } = useStream();
  const audioRef = useRef(null);
  const lastNonce = useRef(null);

  useEffect(() => {
    if (!sound) return;
    if (lastNonce.current === null) { lastNonce.current = sound.nonce; return; }
    if (sound.nonce !== lastNonce.current && sound.file) {
      lastNonce.current = sound.nonce;
      const a = audioRef.current;
      if (a) { a.src = `/sounds/${sound.file}`; a.play().catch(() => {}); }
    }
  }, [sound?.nonce]);

  return <audio ref={audioRef} />;
}
