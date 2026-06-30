'use client';
import { useStream } from '../shared/StreamProvider';
import { useScenes, themeOf } from '../scenes/ScenesProvider';
import Intro from '../scenes/Intro';
import Pause from '../scenes/Pause';
import Outro from '../scenes/Outro';
import GameHud from '../scenes/GameHud';
import Webcam from '../scenes/Webcam';
import Overload from '../overload/Overload';
import MusicEngine from '../music/MusicEngine';
import SoundPlayer from './SoundPlayer';
import AlertOverlay from './AlertOverlay';
import styles from '../scenes/scene.module.css';

// Orquestador del overlay (un solo Browser Source en OBS apuntando a localhost:3000).
// Mantiene todas las pantallas precargadas y conmuta la activa según la escena que
// fija /admin (recibida por SSE). Encima: webcam, popups de cola y música.
export default function Stage() {
  const { scene } = useStream();
  const { themes } = useScenes();
  const theme = themeOf(themes, scene.game);
  const screen = scene.screen;

  const layer = (name) => `${styles.layer} ${screen === name ? styles.layerActive : ''}`;

  // Sin tema disponible (carpeta vacía o aún sin hidratar) no pintamos pantallas
  // para no romper los componentes que esperan `theme`.
  if (!theme) {
    return <main style={{ position: 'relative', width: '1920px', height: '1080px', overflow: 'hidden' }} />;
  }

  return (
    <main style={{ position: 'relative', width: '1920px', height: '1080px', overflow: 'hidden' }}>
      <div className={layer('intro')}><Intro theme={theme} active={screen === 'intro'} endsAt={scene.countdownEndsAt} /></div>
      <div className={layer('pause')}><Pause theme={theme} /></div>
      <div className={layer('outro')}><Outro theme={theme} /></div>
      <div className={layer('game')}><GameHud theme={theme} /></div>

      {/* Webcam: cámara siempre activa, visible solo en la escena de juego. */}
      <Webcam visible={screen === 'game'} />

      {/* Popups de cola / next-match (módulo de ajedrez) por encima del juego. */}
      <Overload />

      {/* Reproductor + visualizador de música (audio capturado por OBS). */}
      <MusicEngine />

      {/* Efectos de sonido disparados desde /admin. */}
      <SoundPlayer />

      {/* Animación de primer mensaje / nuevo follow (el sonido va aparte en /admin). */}
      <AlertOverlay />
    </main>
  );
}
