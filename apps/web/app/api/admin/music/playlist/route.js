import { getLibrary, savePlaylist, deletePlaylist, renamePlaylist } from '@stream-toolkit/common/music';

// Gestión de playlists del manifiesto (crear/guardar orden, borrar, renombrar).
export async function GET() {
  return Response.json(getLibrary());
}

export async function POST(request) {
  const { action, name, tracks, to } = await request.json().catch(() => ({}));

  switch (action) {
    case 'save':
      if (!name) return Response.json({ error: 'falta el nombre' }, { status: 400 });
      savePlaylist(name, tracks || []);
      break;
    case 'delete':
      deletePlaylist(name);
      break;
    case 'rename':
      renamePlaylist(name, to);
      break;
    default:
      return Response.json({ error: 'acción no válida' }, { status: 400 });
  }

  return Response.json(getLibrary());
}
