'use client';
import { useEffect, useState } from 'react';
import styles from './scene.module.css';
import { HANDLE } from './config';

// HUD transparente que se muestra durante la partida (el juego se ve por debajo,
// en OBS la captura de juego).
export default function GameHud({ theme }) {
  const [clock, setClock] = useState('00:00:00');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('es-ES', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const ticker = `Jugando: ${theme.gameLabel}  ✦  ${theme.ticker}  ✦  `;

  return (
    <div className={styles.hud} style={{ ...theme.vars, fontFamily: theme.font }}>
      <div className={`${styles.corner} ${styles.cTL}`} />
      <div className={`${styles.corner} ${styles.cTR}`} />
      <div className={`${styles.corner} ${styles.cBL}`} />
      <div className={`${styles.corner} ${styles.cBR}`} />

      <div className={styles.top}>
        <div className={styles.panel}>
          <div className={styles.badge}>{theme.emoji}</div>
          <div>
            <div className={styles.name}>{HANDLE}</div>
            <div className={styles.sub}>{theme.hudSub}</div>
          </div>
        </div>
        <div className={styles.panel}>
          <div className={styles.live}><span className={styles.dot} />EN VIVO</div>
          <div className={styles.sep} />
          <div className={styles.clock}>{clock}</div>
          <div className={styles.sep} />
          <div className={styles.crest}>{theme.crest}</div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.tag}>{theme.hudTag}</div>
        <div className={styles.track}>
          <span className={styles.scroll}>{`${ticker} `.repeat(3)}</span>
        </div>
      </div>
    </div>
  );
}
