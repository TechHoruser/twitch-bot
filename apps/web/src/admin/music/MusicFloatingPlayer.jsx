'use client';
import { useStream } from '../../shared/StreamProvider';

const post = (body) =>
  fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Mini-player flotante que aparece en todas las tabs excepto Música.
// onOpen: callback para navegar a la tab de música.
export function MusicFloatingPlayer({ onOpen }) {
  const { music } = useStream();
  const track = music?.track;
  const playing = !!music?.playing;

  if (!track) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-2.5 shadow-xl"
      style={{ background: 'rgba(20,20,28,0.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 260 }}
    >
      <span className="text-xl shrink-0">{playing ? '🎵' : '⏸'}</span>

      <button
        onClick={onOpen}
        className="flex flex-col text-left min-w-0 flex-1 hover:opacity-80 transition"
      >
        <span className="text-sm font-bold text-white truncate leading-tight">{track.title}</span>
        <span className="text-xs text-white/60 truncate">{track.artist}</span>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => post({ action: 'prev' })}
          className="w-8 h-8 rounded hover:bg-white/10 text-white flex items-center justify-center text-sm"
        >⏮</button>
        <button
          onClick={() => post({ action: 'toggle' })}
          className="w-8 h-8 rounded hover:bg-white/10 text-white flex items-center justify-center text-base"
        >{playing ? '⏸' : '▶'}</button>
        <button
          onClick={() => post({ action: 'next' })}
          className="w-8 h-8 rounded hover:bg-white/10 text-white flex items-center justify-center text-sm"
        >⏭</button>
      </div>
    </div>
  );
}
