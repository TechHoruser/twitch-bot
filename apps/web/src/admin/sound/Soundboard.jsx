'use client';
import { useEffect, useState } from 'react';

export function Soundboard() {
  const [sounds, setSounds] = useState([]);

  useEffect(() => {
    fetch('/api/admin/sound').then((r) => r.json()).then((d) => setSounds(d.sounds || []));
  }, []);

  const play = (file) => fetch('/api/admin/sound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file }),
  });

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Sonidos</h2>
      {sounds.length === 0 ? (
        <p className="text-sm opacity-60">
          Pon archivos de audio (.mp3/.ogg/.wav) en <code className="bg-white/10 px-1 rounded">apps/web/public/sounds/</code>.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {sounds.map((s) => (
            <button key={s} onClick={() => play(s)} className="bg-white/10 hover:bg-white/20 rounded px-3 py-3 text-sm text-left">
              🔊 {s.replace(/\.[^.]+$/, '')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
