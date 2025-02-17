import { useQueue } from "@/src/shared/hooks/useQueue";
import { useEffect, useMemo, useState } from "react";

const Pawn = ({ name, state, whenHide, whenDestroy }) => {
  useEffect(() => {
    if (state === 'hide') {
      setTimeout(() => {
        whenHide();
      }, 1000);
      return;
    }

    if (state === 'destroy') {
      setTimeout(() => {
        whenDestroy();
      }, 1000);
      return;
    }
  }, [state]);

  const animation = useMemo(() => (
    state === 'hide'
      ? 'animateDisappear 1s ease-out forwards'
      : (
        state === 'destroy'
          ? 'animateDestroy 1s ease-out forwards'
          : 'slideLeft 1s ease-out forwards'
      )
  ), [state]);

  return <div
    className={`
      relative
      opacity-0
      w-[6rem]
      flex
      flex-col
      items-center
      justify-between
      mr-2
    `}
    style={{
      animation,
    }}
  >
    <div className="w-full h-full z-10">
      <img
        src={`/images/pawn-queue.png`}
        alt={name}
      />
      <p className="w-full text-center">{name}</p>
    </div>
  </div>
}

export const QueueOfPawns = () => {
  const { data, setData } = useQueue();

  return (
    <div
      className='absolute w-full bottom-2'
    >
      <div className="w-full flex ml-[32rem]">
        <div className="relative w-[84rem] overflow-hidden">
          <div
            className="absolute w-full h-24 bg-white/5 rounded-xl"
          >
          </div>
          <div className="w-full flex flex-row items-center justify-start">
            {data.map((item) => (
              <Pawn
                key={item.uuid}
                name={item.chesscom}
                state={item.state}
                whenHide={
                  () => setData(prev => prev.map(p => {
                    if (p.uuid === item.uuid) {
                      return { ...p, state: 'destroy' };
                    }
                    return p;
                  }))
                }
                whenDestroy={
                  () => setData(prev => prev.filter(p => p.uuid !== item.uuid))
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
