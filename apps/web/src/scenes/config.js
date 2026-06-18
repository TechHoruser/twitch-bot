// Configuración de las escenas, ajustable por variables de entorno públicas
// (apps/web/.env.local). Cámbialas y reinicia la web.
export const HANDLE = process.env.NEXT_PUBLIC_STREAM_HANDLE || 'TU_CANAL';
export const COUNTDOWN_MINUTES = Number(process.env.NEXT_PUBLIC_COUNTDOWN_MINUTES ?? 5);
