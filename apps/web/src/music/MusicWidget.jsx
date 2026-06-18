'use client';
import { useEffect, useRef } from 'react';

// Visualizador (barras de frecuencia) + "sonando ahora" (Título — Artista, que a
// la vez cubre la atribución CC-BY de Jamendo). Se dibuja en la esquina inferior
// derecha del overlay.
export default function MusicWidget({ analyser, track, playing }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const cctx = canvas.getContext('2d');
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    let raf;
    const N = 28;
    const step = Math.max(1, Math.floor(bins / N));
    const bw = canvas.width / N;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      cctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < N; i++) {
        const v = data[i * step] / 255;
        const h = Math.max(2, v * canvas.height);
        cctx.fillStyle = `rgba(255,255,255,${0.35 + v * 0.6})`;
        cctx.fillRect(i * bw + 1, canvas.height - h, bw - 2, h);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  if (!track) return null;

  return (
    <div
      style={{
        position: 'absolute', right: 46, bottom: 110, width: 340,
        padding: '10px 14px', borderRadius: 12, background: 'rgba(0,0,0,.55)',
        color: '#fff', fontFamily: 'Nunito, sans-serif', zIndex: 4,
        display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'none',
        boxShadow: '0 6px 18px rgba(0,0,0,.4)',
      }}
    >
      <span style={{ fontSize: 24 }}>{playing ? '🎵' : '⏸'}</span>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{track.title}</div>
        <div style={{ fontSize: 12, opacity: .8, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{track.artist}</div>
      </div>
      <canvas ref={canvasRef} width={96} height={36} />
    </div>
  );
}
