import { StreamProvider } from "@/src/shared/StreamProvider";
import { ScenesProvider } from "@/src/scenes/ScenesProvider";
import { getGames, getThemes } from "@stream-toolkit/common/scenes";
import Admin from "@/src/admin/Admin";

export const dynamic = 'force-dynamic';

export default function Home() {
  // Temas descubiertos en el servidor (carpeta de temas) y pasados al panel.
  const scenes = { games: getGames(), themes: getThemes() };
  return (
    <ScenesProvider value={scenes}>
      <StreamProvider>
        <Admin />
      </StreamProvider>
    </ScenesProvider>
  );
}
