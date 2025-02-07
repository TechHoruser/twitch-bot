import { MainImage } from "./MainImage";
import { BlitzSvg, BulletSvg, RapidSvg } from "./NextMatchSvgs";
import { Sound } from "./Sound";

export default function NextMatch({data}) {
  return (
    <div className="w-fit flex flex-col items-center">
      <MainImage
        file={Math.random() < 0.5 ? "super-king.gif" : "super-queen.gif"}
        alt="Next Match"
      />
      <Sound file="wind.mp3" />
      <h1>{data.username}</h1>
      <h3>{data.chesscom}</h3>
      <div className="text-center flex flex-row justify-around">
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
