'use client';
import { useStream } from '../../shared/StreamProvider';

const post = (body) => fetch('/api/music', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const ctrlBtn = 'bg-white/10 hover:bg-white/20 text-white rounded w-12 h-10 text-lg';

export const MusicPanel = () => {
  const { music } = useStream();
  const playlists = music?.playlists ?? [];
  const track = music?.track;
  const playing = !!music?.playing;
  const volume = music?.volume ?? 0.6;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg p-4 bg-white/5 w-full">
      <h2 className="text-lg font-semibold">Música</h2>

      {playlists.length === 0 ? (
        <p className="text-sm opacity-60 text-center">
          No hay música todavía. Ejecuta <code className="bg-white/10 px-1 rounded">npm run setup:music</code>.
        </p>
      ) : (
        <>
          <select
            className="bg-neutral-800 text-white rounded px-3 py-2 w-full"
            value={music?.playlist ?? ''}
            onChange={(e) => post({ action: 'playlist', value: e.target.value })}
          >
            {playlists.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="text-center text-sm min-h-[2.5rem] flex flex-col justify-center">
            {track ? (
              <>
                <span className="font-bold">{track.title}</span>
                <span className="opacity-70">{track.artist}</span>
              </>
            ) : <span className="opacity-50">—</span>}
          </div>

          <div className="flex gap-2 items-center">
            <button className={ctrlBtn} onClick={() => post({ action: 'prev' })}>⏮</button>
            <button className={ctrlBtn} onClick={() => post({ action: 'toggle' })}>{playing ? '⏸' : '▶'}</button>
            <button className={ctrlBtn} onClick={() => post({ action: 'next' })}>⏭</button>
          </div>

          <div className="flex items-center gap-2 w-full">
            <span className="text-xs opacity-60">🔈</span>
            <input
              type="range" min="0" max="1" step="0.01" value={volume}
              className="flex-1"
              onChange={(e) => post({ action: 'volume', value: Number(e.target.value) })}
            />
            <span className="text-xs opacity-60 w-8 text-right">{Math.round(volume * 100)}</span>
          </div>
        </>
      )}
    </div>
  );
};
