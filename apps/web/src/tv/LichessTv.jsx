'use client';
import { useEffect, useState } from 'react';

const POLL_MS = 8000;

// Construye la URL de embed de Lichess (LPV). La ruta /embed/game/{id}/{color}
// está pensada para iframes y, en partidas en juego, sigue las jugadas en vivo.
// `theme` = tema del tablero (brown/blue/green/...), `bg` = light/dark/system.
const embedUrl = (gameId, orientation, { theme = 'brown', bg = 'dark' } = {}) =>
  `https://lichess.org/embed/game/${gameId}/${orientation || 'white'}?theme=${theme}&bg=${bg}`;

export default function LichessTv({ user, theme = 'brown', bg = 'dark' }) {
  // Guardamos el estado de la partida; el src del iframe sólo cambia cuando
  // cambia el gameId, para no recargar el tablero en cada poll.
  const [game, setGame] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/tv?user=${encodeURIComponent(user)}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        setGame((prev) => {
          if (data.gameId && data.gameId !== prev?.gameId) {
            return { gameId: data.gameId, orientation: data.orientation };
          }
          return prev;
        });
      } catch {
        // se reintenta en el siguiente tick
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  if (!game) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#161512] text-2xl text-[#bababa]">
        Esperando tu próxima partida en Lichess…
      </div>
    );
  }

  // Tablero centrado y cuadrado (limitado por la altura) para que en OBS quede
  // encuadrado sin franjas negras laterales.
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#161512]">
      <iframe
        title="Lichess TV"
        src={embedUrl(game.gameId, game.orientation, { theme, bg })}
        className="h-screen w-screen max-w-[100vh] border-0"
        allowFullScreen
      />
    </div>
  );
}
