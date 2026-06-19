import { getObs } from '@/lib/obs';

// GET → lista las fuentes con canal de audio (volumen en dB y mute).
// En vez de filtrar por una lista fija de inputKind (que dejaba fuera el game
// capture, los browser source, media sources, etc.), detectamos las fuentes
// con audio igual que el mezclador de OBS: intentamos leer su volumen y nos
// quedamos con las que responden. Las fuentes de vídeo puro lanzan error y se omiten.
export async function GET() {
  try {
    const obs = await getObs();
    const { inputs } = await obs.call('GetInputList');

    const result = [];
    for (const inp of inputs) {
      const name = inp.inputName;
      try {
        const [vol, mute] = await Promise.all([
          obs.call('GetInputVolume', { inputName: name }),
          obs.call('GetInputMute', { inputName: name }),
        ]);
        // El tipo de monitorización no existe en todas las fuentes; si falla
        // asumimos que está desactivada.
        let monitorType = 'OBS_MONITORING_TYPE_NONE';
        try {
          const mon = await obs.call('GetInputAudioMonitorType', { inputName: name });
          monitorType = mon.monitorType;
        } catch {
          // sin monitorización disponible
        }
        result.push({
          name,
          kind: inp.inputKind,
          volumeDb: vol.inputVolumeDb,
          muted: mute.inputMuted,
          monitoring: monitorType !== 'OBS_MONITORING_TYPE_NONE',
        });
      } catch {
        // La fuente no tiene canal de audio (vídeo puro): se omite.
      }
    }
    return Response.json({ ok: true, inputs: result });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}

// POST { action:'volume'|'mute'|'monitor', input, value } → ajusta la fuente.
export async function POST(request) {
  const { action, input, value } = await request.json().catch(() => ({}));
  try {
    const obs = await getObs();
    if (action === 'volume') {
      await obs.call('SetInputVolume', { inputName: input, inputVolumeDb: Number(value) });
    } else if (action === 'mute') {
      await obs.call('SetInputMute', { inputName: input, inputMuted: !!value });
    } else if (action === 'monitor') {
      // Activar = monitorizar y seguir enviando a la emisión; desactivar = sin monitor.
      const monitorType = value
        ? 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
        : 'OBS_MONITORING_TYPE_NONE';
      await obs.call('SetInputAudioMonitorType', { inputName: input, monitorType });
    } else {
      return Response.json({ error: 'acción no válida' }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
