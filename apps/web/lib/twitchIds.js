import { getBroadcasterId, getModeratorId } from '@stream-toolkit/common/twitchCommands';

// Cachea los ids de Twitch que exige Helix para moderar: broadcaster (dueño del
// canal) y moderator (dueño del token OAuth). Se resuelven una sola vez y se
// reutilizan en todas las rutas de moderación.
let cache = { broadcasterId: null, moderatorId: null };

export async function getTwitchIds() {
  if (!cache.broadcasterId) cache.broadcasterId = await getBroadcasterId();
  if (!cache.moderatorId) cache.moderatorId = await getModeratorId();
  return cache;
}
