'use client';
import { useStream } from '../shared/StreamProvider';
import NextMatch from './overloads/NextMatch';
import { QueueOfPawns } from './overloads/QueueOfPawns';

// Popups del centro (next-match) y la cola de peones. Consume la SSE compartida
// del StreamProvider en lugar de abrir su propia conexión.
export default function Overload() {
  const { overload } = useStream();

  return (
    <>
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
        {overload && overload.type === 'next-match' && <NextMatch data={overload.payload} />}
      </div>
      <QueueOfPawns />
    </>
  );
}
