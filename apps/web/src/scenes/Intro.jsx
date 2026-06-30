'use client';
import { useEffect, useState } from 'react';
import styles from './scene.module.css';
import Socials from './Socials';
import { COUNTDOWN_MINUTES, COUNTDOWN_END_TEXT } from './config';

// Pantalla "Empezamos pronto". Si /admin fijó un fin de cuenta atrás (al iniciar el
// directo, `endsAt`), contamos hacia ese instante para ir sincronizados con el panel;
// si no, arrancamos una cuenta atrás nueva desde ahora (cambios manuales de escena).
export default function Intro({ theme, active, endsAt }) {
  const [count, setCount] = useState('--:--');
  const [boot, setBoot] = useState(theme.boots[0]);

  useEffect(() => {
    if (!active || COUNTDOWN_MINUTES <= 0) return;
    const end = typeof endsAt === 'number' ? endsAt : Date.now() + COUNTDOWN_MINUTES * 60000;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      const m = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setCount(s > 0 ? `${m}:${ss}` : COUNTDOWN_END_TEXT);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, theme, endsAt]);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % theme.boots.length;
      setBoot(theme.boots[i]);
    }, 2200);
    return () => clearInterval(id);
  }, [theme]);

  return (
    <div className={styles.screen} style={{ ...theme.vars, fontFamily: theme.font }}>
      <div className={styles.bg} />
      <div className={styles.grid} />
      {[18, 34, 48, 63, 80].map((left, i) => (
        <span key={i} className={styles.particle} style={{ left: `${left}%`, animationDelay: `${-i}s` }} />
      ))}

      <div className={styles.content}>
        <div className={styles.emoji}>{theme.emoji}</div>
        <div className={styles.kicker}>{theme.kicker}</div>
        <h1 className={styles.h1}>
          {theme.introTitle[0]} <span className={styles.accent}>{theme.introTitle[1]}</span>
        </h1>
        <div className={styles.subt}>{theme.introSub}</div>
        <div className={styles.gameLabel}>{theme.gameLabel}</div>
        {COUNTDOWN_MINUTES > 0 && <div className={styles.count}>{count}</div>}
        <div className={styles.loader}><div className={styles.loaderFill} /></div>
        <div className={styles.boot}>{boot}</div>
      </div>

      <Socials />
    </div>
  );
}
