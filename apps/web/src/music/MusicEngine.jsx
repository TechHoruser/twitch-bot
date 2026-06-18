'use client';
import { useEffect, useRef, useState } from 'react';
import { useStream } from '../shared/StreamProvider';
import MusicWidget from './MusicWidget';

// Reproductor de música del overlay. El estado (playlist/índice/play/volumen) es
// autoritativo en el servidor y llega por SSE; aquí solo se reproduce el archivo y
// se avisa al servidor cuando una pista termina (para avanzar a la siguiente).
export default function MusicEngine() {
  const { music } = useStream();
  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const lastSrcRef = useRef(null);
  const [analyser, setAnalyser] = useState(null);

  // Grafo de Web Audio (para el visualizador). Se crea una sola vez, en cuanto hay
  // gesto/reproducción (AudioContext arranca suspendido en navegadores).
  const ensureGraph = () => {
    if (ctxRef.current || !audioRef.current) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const srcNode = ctx.createMediaElementSource(audioRef.current);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      srcNode.connect(an);
      an.connect(ctx.destination);
      ctxRef.current = ctx;
      setAnalyser(an);
    } catch (e) {
      console.warn('Web Audio no disponible:', e?.message);
    }
  };

  // Cargar la pista cuando cambia el archivo (o se fuerza con next/prev vía nonce).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !music) return;
    const track = music.track;
    const src = track ? `/music/${encodeURIComponent(music.playlist)}/${track.file}` : null;
    if (src && src !== lastSrcRef.current) {
      lastSrcRef.current = src;
      audio.src = src;
      if (music.playing) audio.play().catch(() => {});
    }
  }, [music?.track?.file, music?.playlist, music?.nonce]);

  // Play / pause.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !music) return;
    if (music.playing) {
      ensureGraph();
      if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [music?.playing, music?.nonce]);

  // Volumen.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && music) audio.volume = music.volume ?? 0.6;
  }, [music?.volume]);

  const onEnded = () => {
    fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ended' }),
    }).catch(() => {});
  };

  return (
    <>
      <audio ref={audioRef} onEnded={onEnded} />
      <MusicWidget analyser={analyser} track={music?.track} playing={!!music?.playing} />
    </>
  );
}
