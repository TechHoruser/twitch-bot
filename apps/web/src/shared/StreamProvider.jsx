'use client';
import { createContext, useContext, useEffect, useState } from 'react';

// Una única conexión SSE a /api/overload compartida por toda la página (escena,
// música, cola y overloads del centro), en vez de abrir una por componente.
const StreamContext = createContext(null);

export const useStream = () => useContext(StreamContext) ?? {
  scene: { game: 'king', screen: 'intro' },
  music: null,
  overload: null,
  queue: [],
  setQueue: () => {},
  sound: null,
};

const DEFAULT_SCENE = { game: 'king', screen: 'intro' };

export function StreamProvider({ children }) {
  const [scene, setScene] = useState(DEFAULT_SCENE);
  const [music, setMusic] = useState(null);
  const [overload, setOverload] = useState(null);
  const [queue, setQueue] = useState([]);
  const [sound, setSound] = useState(null);

  useEffect(() => {
    const evtSource = new EventSource('/api/overload');

    evtSource.addEventListener('sceneChange', (e) => setScene(JSON.parse(e.data)));
    evtSource.addEventListener('musicState', (e) => setMusic(JSON.parse(e.data)));
    evtSource.addEventListener('newOverload', (e) => setOverload(JSON.parse(e.data)));
    evtSource.addEventListener('playSound', (e) => setSound(JSON.parse(e.data)));

    evtSource.addEventListener('newQueueElement', (e) => {
      const payload = JSON.parse(e.data);
      setQueue((prev) => [...prev, { ...payload, state: 'alive' }]);
    });
    evtSource.addEventListener('dropQueueElement', (e) => {
      const uuid = e.data;
      setQueue((prev) => prev.map((item) => (
        item.uuid === uuid ? { ...item, state: 'hide' } : item
      )));
    });

    return () => evtSource.close();
  }, []);

  return (
    <StreamContext.Provider value={{ scene, music, overload, queue, setQueue, sound }}>
      {children}
    </StreamContext.Provider>
  );
}
