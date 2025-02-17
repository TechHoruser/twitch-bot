'use client';
import { useEffect, useState } from 'react';
import NextMatch from './overloads/NextMatch';
import { QueueOfPawns } from './overloads/QueueOfPawns';

export default function Overload() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const evtSource = new EventSource('/api/overload');
    evtSource.addEventListener('newOverload', (event) => {
      console.log('event', event);
      const payload = JSON.parse(event.data);
      setData(payload);
    });
    return () => {
      evtSource.close();
    };
  }, []);


  useEffect(() => {
    console.log('data', data);
  }, [data]);

  return (
    <main className='flex h-screen justify-center items-center'>
      {
        data !== null
        && data.type === 'next-match'
        && <NextMatch data={data.payload} />
      }
      <QueueOfPawns />
    </main>
  );
}
