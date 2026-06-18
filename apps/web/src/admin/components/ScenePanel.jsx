'use client';
import { useStream } from '../../shared/StreamProvider';
import { GAMES, THEMES } from '../../scenes/themes';

const SCREENS = [
  { key: 'intro', label: '🔴 Intro' },
  { key: 'game', label: '🎮 Juego' },
  { key: 'pause', label: '⏸ Pausa' },
  { key: 'outro', label: '👋 Cerrando' },
];

const setScene = (partial) => fetch('/api/admin/scene', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(partial),
});

const pill = (active) =>
  `py-2 px-4 rounded font-semibold transition ${
    active ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
  }`;

export const ScenePanel = () => {
  const { scene } = useStream();

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg p-4 bg-white/5 w-full">
      <h2 className="text-lg font-semibold">Escena</h2>

      <span className="text-xs uppercase tracking-widest opacity-60">Juego / tema</span>
      <div className="flex gap-2 flex-wrap justify-center">
        {GAMES.map((g) => (
          <button key={g} className={pill(scene.game === g)} onClick={() => setScene({ game: g })}>
            {THEMES[g].label}
          </button>
        ))}
      </div>

      <span className="text-xs uppercase tracking-widest opacity-60 mt-2">Pantalla</span>
      <div className="flex gap-2 flex-wrap justify-center">
        {SCREENS.map((s) => (
          <button key={s.key} className={pill(scene.screen === s.key)} onClick={() => setScene({ screen: s.key })}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};
