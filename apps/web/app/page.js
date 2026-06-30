import { StreamProvider } from "@/src/shared/StreamProvider";
import { ScenesProvider } from "@/src/scenes/ScenesProvider";
import { getGames, getThemes } from "@stream-toolkit/common/scenes";
import Stage from "@/src/stage/Stage";

export const dynamic = 'force-dynamic';

export default function Home() {
  // Temas descubiertos en el servidor (carpeta de temas) y pasados al overlay.
  const scenes = { games: getGames(), themes: getThemes() };
  return (
    <ScenesProvider value={scenes}>
      <StreamProvider>
        <Stage />
      </StreamProvider>
    </ScenesProvider>
  );
}
