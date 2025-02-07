import { useEffect, useRef, useState } from "react";

const toLoad = [
  'bitsman',
  'jadcgamer',
  'Genevieve',
  'Alfred',
  'Michaela',
  'Chris',
  'Scout',
  'Hunter',
  'Penelope',
  'Amir',
]

export const QueueOfPawns = ({
  // data,
}) => {
  const [data, setData] = useState([]);
  const indexRef = useRef(0);

  useEffect(() => {
    setTimeout(() => {
      setData(prev => [...prev, toLoad[indexRef.current]]);
      indexRef.current = indexRef.current + 1;
    }, 2000);
  }, [data]);

  return (
    <div className="w-full overflow-hidden">
      <div className="flex flex-row items-center justify-start">
        {data.map((name, i) => (
          <div 
            key={i} 
            className="m-2 animate-slideLeft w-12 h-16 flex flex-col items-center justify-between"
            style={{
              animation: `slideLeft 1s ease-out forwards`,
              animationDelay: `${i * 0.2}s`
            }}
          >
            <img
              src={`/images/pawn-queue.png`}
              alt={name}
            />
            <p>{name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
