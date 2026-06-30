// Configuración de las escenas, ajustable por variables de entorno públicas
// (apps/web/.env.local). Cámbialas y reinicia la web.
export const HANDLE = process.env.NEXT_PUBLIC_STREAM_HANDLE || 'TU_CANAL';
export const COUNTDOWN_MINUTES = Number(process.env.NEXT_PUBLIC_COUNTDOWN_MINUTES ?? 5);
// Texto unificado que muestra la intro cuando la cuenta atrás llega a 0.
export const COUNTDOWN_END_TEXT = '¡EMPEZAMOS!';
// Segundos que la intro permanece a 0 ("¡EMPEZAMOS!") antes del paso automático a juego.
export const INTRO_GRACE_SECONDS = Number(process.env.NEXT_PUBLIC_INTRO_GRACE_SECONDS ?? 10);
