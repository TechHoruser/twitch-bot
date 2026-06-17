import LichessTv from "@/src/tv/LichessTv";

export const dynamic = "force-dynamic";

// Overlay de TV de Lichess para OBS. Sigue la partida en vivo del streamer.
// El usuario sale de LICHESS_TV_USER, con override opcional por ?user=.
export default async function Tv({ searchParams }) {
  const params = await searchParams;
  const user = params?.user || process.env.LICHESS_TV_USER || "";
  const theme = params?.theme || "brown";
  const bg = params?.bg || "dark";

  if (!user) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-[#161512] text-center text-[#bababa]">
        <p className="text-2xl font-bold">Configura tu usuario de Lichess</p>
        <p className="text-base opacity-80">
          Define <code>LICHESS_TV_USER</code> en el .env de la web o abre{" "}
          <code>/tv?user=TU_USUARIO</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden">
      <LichessTv user={user} theme={theme} bg={bg} />
    </main>
  );
}
