import fs from 'fs';
import path from 'path';
import { playSound } from '@stream-toolkit/common/sound';

const SOUNDS_DIR = path.join(process.cwd(), 'public', 'sounds');
const AUDIO = /\.(mp3|ogg|wav|m4a)$/i;

// GET: lista los efectos disponibles en public/sounds/.
export async function GET() {
  let sounds = [];
  try {
    sounds = fs.readdirSync(SOUNDS_DIR).filter((f) => AUDIO.test(f));
  } catch { /* carpeta inexistente */ }
  return Response.json({ sounds });
}

// POST { file }: dispara el sonido en el overlay (vía SSE playSound).
export async function POST(request) {
  const { file } = await request.json().catch(() => ({}));
  if (!file || !AUDIO.test(file)) {
    return Response.json({ error: 'fichero de sonido no válido' }, { status: 400 });
  }
  const state = playSound(path.basename(file));
  return Response.json({ ok: true, state });
}
