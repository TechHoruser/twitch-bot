'use client';
import { createContext, useContext, useRef, useState } from 'react';

const Ctx = createContext({ currentTime: 0, seek: () => {}, register: () => {}, setCurrentTime: () => {} });

export const useMusicAudioCtx = () => useContext(Ctx);

export function MusicAudioProvider({ children }) {
  const [currentTime, setCurrentTime] = useState(0);
  const audioElRef = useRef(null);

  const register = (el) => { audioElRef.current = el; };
  const seek = (seconds) => { if (audioElRef.current) audioElRef.current.currentTime = seconds; };

  return (
    <Ctx.Provider value={{ currentTime, setCurrentTime, seek, register }}>
      {children}
    </Ctx.Provider>
  );
}
