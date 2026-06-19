import {
  getMusic, currentTrack, playlistNames,
  setPlaying, togglePlay, next, prev, setVolume, setPlaylist, removeCurrentTrack,
} from '@stream-toolkit/common/music';

const withTrack = (state) => ({ state, track: currentTrack(state), playlists: playlistNames() });

export async function GET() {
  return Response.json(withTrack(getMusic()));
}

export async function POST(request) {
  const { action, value } = await request.json().catch(() => ({}));

  let state;
  switch (action) {
    case 'play': state = setPlaying(true); break;
    case 'pause': state = setPlaying(false); break;
    case 'toggle': state = togglePlay(); break;
    case 'next':
    case 'ended': state = next(); break;     // `ended` lo manda el overlay al acabar la pista
    case 'prev': state = prev(); break;
    case 'volume': state = setVolume(value); break;
    case 'playlist': state = setPlaylist(value); break;
    case 'removeCurrent': state = removeCurrentTrack(); break;
    default:
      return Response.json({ error: 'acción no válida' }, { status: 400 });
  }

  return Response.json(withTrack(state));
}
