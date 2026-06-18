'use client';
import { useEffect, useRef } from 'react';

// Webcam capturada dentro de la app (getUserMedia). La cámara se mantiene activa
// mientras la página esté abierta; solo se muestra/oculta según la escena (evita
// reabrir el dispositivo en cada cambio). El dispositivo se puede fijar con el
// query param ?cam=<deviceId> o NEXT_PUBLIC_CAM_DEVICE_ID.
export default function Webcam({ visible }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const pickDeviceId = () => {
      if (typeof window !== 'undefined') {
        const q = new URLSearchParams(window.location.search).get('cam');
        if (q) return q;
      }
      return process.env.NEXT_PUBLIC_CAM_DEVICE_ID || undefined;
    };

    async function start() {
      try {
        const deviceId = pickDeviceId();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : { width: 1280, height: 720 },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        console.warn('No se pudo acceder a la webcam:', e?.message);
      }
    }
    start();

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute', left: 60, bottom: 60, width: 480, height: 270,
        borderRadius: 16, overflow: 'hidden', border: '3px solid rgba(255,255,255,.85)',
        boxShadow: '0 8px 24px rgba(0,0,0,.5)', background: '#000',
        zIndex: 3, opacity: visible ? 1 : 0,
        transition: 'opacity .4s ease', pointerEvents: 'none',
      }}
    >
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}
