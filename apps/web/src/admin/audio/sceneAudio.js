'use client';
// Presets de audio por escena y colección, guardados en localStorage. Para cada
// par (colección, escena) se almacena un mapa disperso de fuentes de OBS con su
// nivel (multiplicador lineal 0..1, donde 1 = 0 dB = 100%) y si va silenciada:
//
//   { [colección]: { [escena]: { [fuente]: { mul: 0..1, muted: bool } } } }
//
// Sólo se aplican a OBS las fuentes presentes en el preset, así que una escena sin
// preset no toca el audio. El mismo módulo lo usa la pestaña de escenas/audio y el
// hook de la intro del directo (para aplicar los niveles al cambiar de escena).
const KEY = 'sceneAudioPresets';

export const loadPresets = () => {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
};

export const savePresets = (presets) => {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(presets));
};

export const getPreset = (collection, scene) => loadPresets()?.[collection]?.[scene] || {};

// Inserta/actualiza una fuente dentro del preset de (colección, escena).
export const setSource = (collection, scene, source, patch) => {
  const presets = loadPresets();
  const col = presets[collection || ''] || (presets[collection || ''] = {});
  const sc = col[scene || ''] || (col[scene || ''] = {});
  sc[source] = { mul: 1, muted: false, ...sc[source], ...patch };
  savePresets(presets);
  return sc[source];
};

// Quita una fuente del preset de (colección, escena).
export const removeSource = (collection, scene, source) => {
  const presets = loadPresets();
  const sc = presets?.[collection]?.[scene];
  if (sc && sc[source]) { delete sc[source]; savePresets(presets); }
};

const audioPost = (body) => fetch('/api/audio', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).catch(() => {});

// Aplica a OBS los niveles guardados para una escena. No hace nada si no hay preset.
export const applyPreset = async (collection, scene) => {
  const preset = getPreset(collection, scene);
  const entries = Object.entries(preset);
  if (entries.length === 0) return;
  await Promise.all(entries.flatMap(([source, lvl]) => [
    audioPost({ action: 'volumeMul', input: source, value: lvl.mul }),
    audioPost({ action: 'mute', input: source, value: !!lvl.muted }),
  ]));
};

// Exporta todos los presets como objeto serializable (para descargar a JSON).
export const exportPresets = () => loadPresets();

// Importa presets desde un objeto. Por defecto reemplaza; con merge=true fusiona
// por colección/escena. Devuelve los presets resultantes.
export const importPresets = (data, { merge = false } = {}) => {
  if (!data || typeof data !== 'object') throw new Error('JSON no válido');
  if (!merge) { savePresets(data); return data; }
  const presets = loadPresets();
  for (const [col, scenes] of Object.entries(data)) {
    presets[col] = presets[col] || {};
    for (const [scene, sources] of Object.entries(scenes || {})) {
      presets[col][scene] = { ...(presets[col][scene] || {}), ...sources };
    }
  }
  savePresets(presets);
  return presets;
};
