import { MainImage } from "./MainImage";
import { BlitzSvg, BulletSvg, RapidSvg } from "./NextMatchSvgs";
import { Sound } from "./Sound";

// Flecha de tendencia del rating (prog de Lichess). Verde si sube, rojo si baja.
function ProgArrow({ prog }) {
  if (!prog) return null;
  const up = prog > 0;
  return (
    <span className={`ml-1 text-base font-semibold ${up ? "text-green-400" : "text-red-400"}`}>
      {up ? "▲" : "▼"}{Math.abs(prog)}
    </span>
  );
}

function RatingItem({ Icon, perf }) {
  const rating = perf?.rating ?? "N/A";
  return (
    <div className="flex flex-col items-center">
      <Icon />
      <p className="flex items-baseline">
        {rating}
        <ProgArrow prog={perf?.prog} />
      </p>
    </div>
  );
}

// Bloque de una cuenta: badge del proveedor, handle y los tres ratings.
function AccountBlock({ account }) {
  const ratings = account?.ratings ?? {};
  return (
    <div className="flex w-full flex-col items-center">
      <span className="text-xs uppercase tracking-widest text-[#e3aa24] opacity-90">
        {account?.provider}
      </span>
      <h3 className="text-3xl font-bold leading-tight mb-1">{account?.chessUser}</h3>
      <div className="text-center text-2xl font-bold flex flex-row justify-around w-full gap-6">
        <RatingItem Icon={BulletSvg} perf={ratings.bullet} />
        <RatingItem Icon={BlitzSvg} perf={ratings.blitz} />
        <RatingItem Icon={RapidSvg} perf={ratings.rapid} />
      </div>
    </div>
  );
}

export default function NextMatch({ data }) {
  console.log("NextMatch", data);
  // Soporta el formato nuevo (accounts[]) y el antiguo (chessUser/ratings sueltos).
  const accounts = data?.accounts
    ?? (data?.chessUser ? [{ provider: data.provider, chessUser: data.chessUser, ratings: data.ratings }] : []);

  return (
    <div className="w-fit aspect-square rounded-3xl flex flex-col items-center justify-between bg-[#302e2b] bg-opacity-95 px-16 py-4">
      <MainImage
        file={Math.random() < 0.5 ? "super-king.gif" : "super-queen.gif"}
        alt="Next Match"
      />
      <Sound file="wind.mp3" />
      <div className="flex w-full flex-col items-center gap-3">
        {accounts.map((account, i) => (
          <AccountBlock key={account?.providerKey ?? i} account={account} />
        ))}
      </div>
    </div>
  );
}
