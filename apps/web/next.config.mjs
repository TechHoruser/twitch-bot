/** @type {import('next').NextConfig} */
const nextConfig = {
  // El paquete del workspace (@stream-toolkit/common) es CommonJS sin transpilar;
  // pedimos a Next que lo procese al construir.
  transpilePackages: ['@stream-toolkit/common'],
  // obs-websocket-js usa `ws` en servidor: lo dejamos fuera del bundle.
  serverExternalPackages: ['obs-websocket-js'],
};

export default nextConfig;
