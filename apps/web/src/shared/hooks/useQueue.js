'use client';
import { useStream } from '../StreamProvider';

// La cola ahora vive en el StreamProvider (una sola conexión SSE). Mantenemos este
// hook por compatibilidad con los consumidores existentes (p.ej. Admin).
export const useQueue = () => {
  const { queue, setQueue } = useStream();
  return { data: queue, setData: setQueue };
};
