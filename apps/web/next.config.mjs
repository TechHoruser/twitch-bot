/** @type {import('next').NextConfig} */
const nextConfig = {
  // El paquete del workspace (@chess-stream/common) es CommonJS sin transpilar;
  // pedimos a Next que lo procese al construir.
  transpilePackages: ['@chess-stream/common'],
};

export default nextConfig;
