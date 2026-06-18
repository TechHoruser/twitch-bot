import { getObs } from '@/lib/obs';

// Fuentes de OBS que son de audio (entradas/salidas de captura por plataforma).
const AUDIO_KINDS = [
  'wasapi_input_capture', 'wasapi_output_capture', 'wasapi_process_output_capture',
  'coreaudio_input_capture', 'coreaudio_output_capture',
  'pulse_input_capture', 'pulse_output_capture',
];

// GET → lista las fuentes de audio con su volumen (dB) y mute.
export async function GET() {
  try {
    const obs = await getObs();
    const { inputs } = await obs.call('GetInputList');
    const audio = inputs.filter((i) => AUDIO_KINDS.includes(i.inputKind));

    const result = [];
    for (const inp of audio) {
      const name = inp.inputName;
      const [vol, mute] = await Promise.all([
        obs.call('GetInputVolume', { inputName: name }),
        obs.call('GetInputMute', { inputName: name }),
      ]);
      result.push({ name, kind: inp.inputKind, volumeDb: vol.inputVolumeDb, muted: mute.inputMuted });
    }
    return Response.json({ ok: true, inputs: result });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}

// POST { action:'volume'|'mute', input, value } → ajusta la fuente.
export async function POST(request) {
  const { action, input, value } = await request.json().catch(() => ({}));
  try {
    const obs = await getObs();
    if (action === 'volume') {
      await obs.call('SetInputVolume', { inputName: input, inputVolumeDb: Number(value) });
    } else if (action === 'mute') {
      await obs.call('SetInputMute', { inputName: input, inputMuted: !!value });
    } else {
      return Response.json({ error: 'acción no válida' }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
