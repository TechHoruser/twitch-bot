'use client';
import { useEffect, useState } from 'react';
import NextMatch from './overloads/NextMatch';

export default function Overload() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const evtSource = new EventSource('/api/overload');
    evtSource.addEventListener('newOverload', (event) => {
      const payload = JSON.parse(event.data);
      setData(payload);
    });
    return () => {
      evtSource.close();
    };
  }, []);

  return (
    <main className='flex h-screen justify-center items-center'>
      {
        data !== null
        && data.type === 'next-match'
        && <NextMatch data={data.payload} />
      }
    </main>
  );
}
