import { MainImage } from "./MainImage";
import { BlitzSvg, BulletSvg, RapidSvg } from "./NextMatchSvgs";
import { Sound } from "./Sound";

const twitchIcon = "https://cdn-icons-png.flaticon.com/512/5968/5968819.png";
const chesscomIcon = "/images/chesscom-icon.png";

export default function NextMatch({data}) {
  console.log('NextMatch', data);
  return (
    <div className="w-fit aspect-square rounded-3xl flex flex-col items-center justify-between bg-[#302e2b] bg-opacity-95 px-16 py-4">
      <MainImage
        file={Math.random() < 0.5 ? "super-king.gif" : "super-queen.gif"}
        alt="Next Match"
      />
      <Sound file="wind.mp3" />
      <div className="flex w-full flex-row justify-center items-center">
        {/* <div className="flex flex-col items-center">
          <img
            src={twitchIcon}
            alt="Twitch"
            className="w-8 h-8 inline-block"
          />
          <h1 className="text-3xl font-bold">
            {data.username}
          </h1>
        </div> */}
        <div className="flex flex-col items-center mb-4">
          {/* <img
            src={chesscomIcon}
            alt="Chess.com"
            className="w-14 h-14 inline-block"
          /> */}
          <h3
            className="text-3xl font-bold"
          >
            {data.chesscom}
          </h3>
        </div>
      </div>
      <div className="text-center text-2xl font-bold flex flex-row justify-around w-full">
        <div className="flex flex-col items-center">
          <BulletSvg />
          <p>{data.chesscomRating.bullet.last.rating}</p>
        </div>
        <div className="flex flex-col items-center">
          <BlitzSvg />
          <p>{data.chesscomRating.blitz.last.rating}</p>
        </div>
        <div className="flex flex-col items-center">
          <RapidSvg />
          <p>{data.chesscomRating.rapid.last.rating}</p>
        </div>
      </div>
    </div>
  );
}
