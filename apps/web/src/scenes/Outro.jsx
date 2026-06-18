import styles from './scene.module.css';
import Socials from './Socials';

// Pantalla "Cerrando".
export default function Outro({ theme }) {
  return (
    <div className={styles.screen} style={{ ...theme.vars, fontFamily: theme.font }}>
      <div className={styles.bg} />
      <div className={styles.grid} />
      {[20, 38, 60, 78, 50].map((left, i) => (
        <span
          key={i}
          className={`${styles.particle} ${styles.particleFall}`}
          style={{ left: `${left}%`, animationDelay: `${-i}s` }}
        />
      ))}

      <div className={styles.content}>
        <div className={styles.emoji}>{theme.emoji}</div>
        <h1 className={styles.h1}>
          {theme.outroTitle[0]} <span className={styles.accent}>{theme.outroTitle[1]}</span>
        </h1>
        <div className={styles.subt}>{theme.outroSub}</div>
        <div className={styles.gameLabel}>{theme.gameLabel}</div>
        <div className={styles.cta}>{theme.outroCta}</div>
      </div>

      <Socials />
    </div>
  );
}
