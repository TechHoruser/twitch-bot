'use client';
import { useEffect, useRef } from 'react';
import { useStream } from '../../shared/StreamProvider';
import { useMusicAudioCtx } from './MusicAudioContext';

const post = (body) =>
  fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function MusicAudio() {
  const { music } = useStream();
  const { register, setCurrentTime } = useMusicAudioCtx();
  const audioRef = useRef(null);
  const lastSrcRef = useRef(null);

  useEffect(() => {
    register(audioRef.current);
    return () => register(null);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !music?.track) return;
    const src = `/music/${encodeURIComponent(music.playlist)}/${music.track.file}`;
    if (src !== lastSrcRef.current) {
      lastSrcRef.current = src;
      audio.src = src;
      setCurrentTime(0);
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

  return (
    <audio
      ref={audioRef}
      onEnded={() => post({ action: 'ended' })}
      onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
    />
  );
}
