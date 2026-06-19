'use client';
import { useEffect, useState } from 'react';
import { useStream } from '../shared/StreamProvider';
import styles from './AlertOverlay.module.css';

// Muestra la animación de "primer mensaje" / "nuevo follow" en el overlay. Ignora
// el estado inicial recibido al conectar (solo reacciona cuando cambia el nonce) y
// se oculta sola tras la animación.
const ALERTS = {
  'first-message': { cls: styles.first, icon: '👋', kicker: 'Primer mensaje de' },
  follow: { cls: styles.follow, icon: '💜', kicker: 'Nuevo follow de' },
};

export default function AlertOverlay() {
  const { alert } = useStream();
  const [current, setCurrent] = useState(null);
  const [lastNonce, setLastNonce] = useState(null);

  useEffect(() => {
    if (!alert) return;
    if (lastNonce === null) { setLastNonce(alert.nonce); return; }
    if (alert.nonce === lastNonce || !alert.type) return;
    setLastNonce(alert.nonce);
    setCurrent(alert);
    const id = setTimeout(() => setCurrent(null), 5000); // dura lo que la animación
    return () => clearTimeout(id);
  }, [alert?.nonce]);

  if (!current) return null;
  const meta = ALERTS[current.type] || ALERTS['first-message'];

  return (
    <div className={styles.wrap}>
      <div key={current.nonce} className={`${styles.card} ${meta.cls}`}>
        <span className={styles.icon}>{meta.icon}</span>
        <span className={styles.text}>
          <span className={styles.kicker}>{meta.kicker}</span>
          <span className={styles.name}>{current.name}</span>
        </span>
      </div>
    </div>
  );
}
