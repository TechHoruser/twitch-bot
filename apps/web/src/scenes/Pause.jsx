import styles from './scene.module.css';
import Socials from './Socials';

// Pantalla "Pausa".
export default function Pause({ theme }) {
  return (
    <div className={styles.screen} style={{ ...theme.vars, fontFamily: theme.font }}>
      <div className={styles.bg} />
      <div className={styles.grid} />

      <div className={styles.content}>
        <div className={styles.emoji}>{theme.emoji}</div>
        <div className={styles.kicker}>{theme.kicker}</div>
        <h1 className={styles.h1}><span className={styles.accent}>{theme.pauseTitle}</span></h1>
        <div className={styles.subt}>{theme.pauseSub}</div>
        <div className={styles.gameLabel}>{theme.gameLabel}</div>
        <div className={styles.pauseBars}><i /><i /></div>
      </div>

      <Socials />
    </div>
  );
}
