'use client';
import { useEffect, useRef } from 'react';
import { useStream } from '../../shared/StreamProvider';

const post = (body) =>
  fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Reproductor de audio persistente del admin. No renderiza nada visible;
// se monta una sola vez en Admin para que cambiar de tab no corte la música.
export function MusicAudio() {
  const { music } = useStream();
  const audioRef = useRef(null);
  const lastSrcRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !music?.track) return;
    const src = `/music/${encodeURIComponent(music.playlist)}/${music.track.file}`;
    if (src !== lastSrcRef.current) {
      lastSrcRef.current = src;
      audio.src = src;
      if (music.playing) audio.play().catch(() => {});
    }
  }, [music?.track?.file, music?.playlist, music?.nonce]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (music?.playing) audio.play().catch(() => {});
    else audio.pause();
  }, [music?.playing, music?.nonce]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && music) audio.volume = music.volume ?? 0.6;
  }, [music?.volume]);

  return <audio ref={audioRef} onEnded={() => post({ action: 'ended' })} />;
}
