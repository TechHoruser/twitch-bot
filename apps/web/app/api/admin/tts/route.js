import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Voz natural (TTS) para la lectura privada del chat. Lanza el binario de Piper
// (descargado con `npm run setup:tts`) como subproceso: le pasamos el texto por
// stdin y nos devuelve PCM crudo por stdout, que envolvemos en un WAV y mandamos
// al navegador. La síntesis es local, gratuita y offline; las rutas del binario y
// del modelo viven solo aquí (PIPER_BIN / PIPER_VOICES_DIR / PIPER_MODEL).

const env = () => ({
  bin: process.env.PIPER_BIN || '',
  voicesDir: process.env.PIPER_VOICES_DIR || '',
  model: process.env.PIPER_MODEL || '',
});

// GET → estado de la voz natural: si está configurada y qué voces hay descargadas
// (para poder elegirlas en el panel).
export async function GET() {
  const { bin, voicesDir, model } = env();
  if (!bin || !voicesDir) return Response.json({ ok: true, configured: false, voices: [], current: '' });
  try {
    const voices = (await readdir(voicesDir)).filter((f) => f.endsWith('.onnx'));
    return Response.json({ ok: true, configured: voices.length > 0, voices, current: model || voices[0] || '' });
  } catch {
    return Response.json({ ok: true, configured: false, voices: [], current: '' });
  }
}

// Cabecera WAV PCM (16-bit, mono) para envolver el stream crudo de Piper.
function wavHeader(dataLen, sampleRate) {
  const blockAlign = 2; // 1 canal * 16 bits / 8
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  return buf;
}

async function sampleRateOf(modelPath) {
  try {
    const cfg = JSON.parse(await readFile(`${modelPath}.json`, 'utf8'));
    return cfg?.audio?.sample_rate || 22050;
  } catch {
    return 22050;
  }
}

// POST { text, rate?, voice? } → audio/wav con el texto sintetizado.
export async function POST(request) {
  const { bin, voicesDir, model } = env();
  if (!bin || !voicesDir || !model) {
    return Response.json({ ok: false, error: 'Piper no configurado. Ejecuta `npm run setup:tts`.' }, { status: 503 });
  }

  const { text, rate = 1, voice } = await request.json().catch(() => ({}));
  // Quita caracteres de control y colapsa espacios (deja el texto en una línea).
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  if (!clean) return Response.json({ ok: false, error: 'texto vacío' }, { status: 400 });

  // Voz: por defecto PIPER_MODEL; si llega `voice`, solo el nombre de fichero y debe
  // existir en la carpeta de voces (evita salir del directorio).
  const modelName = voice && /^[\w.-]+\.onnx$/.test(voice) ? voice : model;
  const modelPath = path.join(voicesDir, modelName);
  if (path.dirname(modelPath) !== path.resolve(voicesDir)) {
    return Response.json({ ok: false, error: 'voz no válida' }, { status: 400 });
  }

  // rate del panel (0.5..1.6) -> length_scale de Piper (inverso: menor = más rápido).
  // Solo lo añadimos si difiere de 1, para que el caso por defecto no dependa del flag.
  const args = ['--model', modelPath, '--output-raw'];
  const r = Number(rate) || 1;
  if (r !== 1) args.push('--length_scale', Math.min(2, Math.max(0.4, 1 / r)).toFixed(2));

  try {
    const sampleRate = await sampleRateOf(modelPath);
    const pcm = await new Promise((resolve, reject) => {
      const piper = spawn(bin, args, {
        cwd: path.dirname(bin), // para que encuentre espeak-ng-data junto al ejecutable
      });
      const chunks = [];
      let stderr = '';
      const timer = setTimeout(() => { piper.kill(); reject(new Error('timeout de síntesis')); }, 20000);
      piper.stdout.on('data', (d) => chunks.push(d));
      piper.stderr.on('data', (d) => { stderr += d.toString(); });
      piper.on('error', (e) => { clearTimeout(timer); reject(e); });
      piper.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0 && chunks.length === 0) return reject(new Error(stderr.trim() || `piper salió con código ${code}`));
        resolve(Buffer.concat(chunks));
      });
      piper.stdin.write(clean);
      piper.stdin.end();
    });

    const wav = Buffer.concat([wavHeader(pcm.length, sampleRate), pcm]);
    return new Response(wav, {
      headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(wav.length), 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
