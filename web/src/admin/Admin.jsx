'use client';

import { useEffect } from 'react';
import { useQueue } from '../shared/hooks/useQueue';
import { GroupButtons } from './components/GroupButtons';

const formatElement = (element) => {
  console.log(element);
  return {
    uuid: element.uuid,
    chesscom: element.chesscom,
    twitch: element.username,
    rating: {
      bullet: element.chesscomRating.bullet.last.rating,
      blitz: element.chesscomRating.blitz.last.rating,
      rapid: element.chesscomRating.rapid.last.rating,
    }
  }
}

export default function Admin() {
  const { data } = useQueue();

  useEffect(() => {
    console.log(data);
  }, [data]);

  return (
    <main className='flex h-screen v-screen'>
      <div className='w-3/5 flex flex-col justify-center items-center'>
        <div
          className='flex justify-center items-center h-full w-full bg-white/5'
        >
          <GroupButtons
            title='Cola'
            buttons={[
              {
                onClick: () => {
                  fetch('/api/admin/queue/pop', {
                    method: 'GET',
                  });
                },
                text: 'Siguiente',
              },
              // <button
              //   className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
              //   onClick={() => {
              //     fetch('/api/admin/queue', {
              //       method: 'DELETE',
              //     });
              //   }}
              // >Limpiar</button>,
              {
                onClick: () => {
                  fetch('/api/admin/queue', {
                    method: 'DELETE',
                  });
                },
                text: 'Limpiar',
                confirm: true,
              }
            ]}
          />
        </div>
      </div>
      <div className='w-2/5 flex flex-col justify-center items-center'>
        <div
          className='flex h-full w-full'
        >
          <ul>
            {
              data.map((item) => {
                if (item.state === 'hide') {
                  return null;
                }
                const element = formatElement(item);
                return <li key={item.uuid}>
                  <div className='flex gap-4'>
                    <p>{element.twitch}</p>
                    <p>{element.chesscom}</p>
                    <div className='flex gap-1'>
                      <p>{element.rating.bullet}</p>
                      <span>|</span>
                      <p>{element.rating.blitz}</p>
                      <span>|</span>
                      <p>{element.rating.rapid}</p>
                    </div>
                  </div>
                </li>;
              })
            }
          </ul>
        </div>
      </div>
    </main>
  );
}
