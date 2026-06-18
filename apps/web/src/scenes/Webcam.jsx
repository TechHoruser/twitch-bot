'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Webcam capturada dentro de la app (getUserMedia). La cámara se mantiene activa
// mientras la página esté abierta; solo se muestra/oculta según la escena. Si no
// hay acceso a la cámara, muestra un aviso visible (importante dentro de OBS) y
// reintenta solo cada 5 s. El dispositivo se puede fijar con ?cam=<deviceId> o
// NEXT_PUBLIC_CAM_DEVICE_ID.
export default function Webcam({ visible }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const aliveRef = useRef(true);
  const [error, setError] = useState(null);

  const start = useCallback(async () => {
    const pickDeviceId = () => {
      if (typeof window !== 'undefined') {
        const q = new URLSearchParams(window.location.search).get('cam');
        if (q) return q;
      }
      return process.env.NEXT_PUBLIC_CAM_DEVICE_ID || undefined;
    };
    try {
      const deviceId = pickDeviceId();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: 1280, height: 720 },
        audio: false,
      });
      if (!aliveRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setError(null);
    } catch (e) {
      setError(e?.name || 'Error');
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    start();
    return () => {
      aliveRef.current = false;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [start]);

  // Reintento automático mientras haya error (p.ej. si liberas la cámara de otra app).
  useEffect(() => {
    if (!error) return undefined;
    const id = setInterval(start, 5000);
    return () => clearInterval(id);
  }, [error, start]);

  const hint = {
    NotAllowedError: 'Permiso denegado. Permite la cámara para apps de escritorio en el SO y recarga la fuente.',
    NotFoundError: 'No se encontró ninguna cámara conectada.',
    NotReadableError: 'La cámara está en uso por otra app u otra fuente de OBS. Ciérrala.',
    AbortError: 'La cámara está en uso por otra app u otra fuente de OBS. Ciérrala.',
    OverconstrainedError: 'El deviceId fijado no existe. Revisa NEXT_PUBLIC_CAM_DEVICE_ID.',
  }[error] || (error ? `Error de cámara: ${error}` : '');

  return (
    <div
      style={{
        position: 'absolute', left: 60, bottom: 60, width: 480, height: 270,
        borderRadius: 16, overflow: 'hidden', border: '3px solid rgba(255,255,255,.85)',
        boxShadow: '0 8px 24px rgba(0,0,0,.5)', background: '#000',
        zIndex: 3, opacity: (visible || error) ? 1 : 0,
        transition: 'opacity .4s ease', pointerEvents: 'auto',
        fontFamily: 'Nunito, sans-serif', color: '#fff',
      }}
    >
      {error ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8, padding: 18, background: 'linear-gradient(180deg,#2a1230,#160c1e)' }}>
          <div style={{ fontSize: 36 }}>📷⚠️</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Sin acceso a la cámara</div>
          <div style={{ fontSize: 13, opacity: .85, lineHeight: 1.3 }}>{hint}</div>
          <button
            onClick={start}
            style={{ marginTop: 6, padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#f5c542', color: '#160c1e', fontWeight: 700 }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  );
}
