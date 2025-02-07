import { useEffect, useState } from "react";

const Pawn = ({ position, name }) => (
  <div
    className="m-2 animate-slideLeft w-12 h-16 flex flex-col items-center justify-between"
    style={{
      animation: `slideLeft 1s ease-out forwards`,
      animationDelay: `${position * 0.2}s`
    }}
  >
    <img
      src={`/images/pawn-queue.png`}
      alt={name}
    />
    <p>{name}</p>
  </div>
);

export const QueueOfPawns = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const evtSource = new EventSource('/api/overload');
    evtSource.addEventListener('newQueueElement', (event) => {
      const payload = JSON.parse(event.data);
      setData(prev => [...prev, payload]);
    });
    evtSource.addEventListener('dropQueueElement', (event) => {
      const uuid = event.data;
      setData(prev => prev.filter(item => item.uuid !== uuid));
    });
    return () => {
      evtSource.close();
    };
  }, []);

  return (
    <div className="w-full overflow-hidden">
      <div className="flex flex-row items-center justify-start">
        {data.map((item, i) => (
          <Pawn key={i} position={i} name={item.chesscom} />
        ))}
      </div>
    </div>
  );
}
