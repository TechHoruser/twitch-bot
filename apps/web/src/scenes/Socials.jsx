import styles from './scene.module.css';
import { HANDLE } from './config';

export default function Socials() {
  return (
    <div className={styles.foot}>
      <span className={styles.soc}>🟣 Twitch <b>/{HANDLE}</b></span>
      <span className={styles.soc}>🔴 YouTube <b>/{HANDLE}</b></span>
      <span className={styles.soc}>💬 Discord <b>/{HANDLE}</b></span>
    </div>
  );
}
