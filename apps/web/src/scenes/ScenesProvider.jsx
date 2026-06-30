'use client';
import { createContext, useContext } from 'react';

// Temas/escenas disponibles, descubiertos en el SERVIDOR (carpeta de temas en
// @stream-toolkit/common/scenes) y pasados a este contexto desde las páginas. Así
// el overlay y el panel /admin se construyen dinámicamente: añadir un juego =
// soltar un JSON en packages/common/scenes/themes/ (sin tocar este código ni
// ninguna lista). `value` = { games: [...claves en orden], themes: { clave: {...} } }.
const ScenesContext = createContext({ games: [], themes: {} });

export function ScenesProvider({ value, children }) {
  return <ScenesContext.Provider value={value}>{children}</ScenesContext.Provider>;
}

export const useScenes = () => useContext(ScenesContext);

// Tema de un juego con respaldo al primero disponible (evita pantallas en blanco
// si la escena guardada apunta a un juego que ya no existe en la carpeta).
export const themeOf = (themes, game) =>
  themes?.[game] || themes?.[Object.keys(themes || {})[0]] || null;
