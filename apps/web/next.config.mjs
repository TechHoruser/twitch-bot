/** @type {import('next').NextConfig} */
const nextConfig = {
  // @stream-toolkit/common (CommonJS) sólo se importa desde código de servidor
  // (route handlers y server components). Lo dejamos fuera del bundle para que se
  // cargue en runtime desde node_modules: así su __dirname apunta al sitio real y
  // el registro de escenas puede leer su carpeta de temas con fs (ver scenes/).
  // obs-websocket-js usa `ws` en servidor: también lo dejamos fuera del bundle.
  serverExternalPackages: ['@stream-toolkit/common', 'obs-websocket-js'],
};

export default nextConfig;
