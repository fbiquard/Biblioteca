/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Playwright debe quedar fuera del bundle de server components / route handlers
  // para que pueda lanzar el navegador desde node_modules en runtime.
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'playwright-core'],
  },
};

module.exports = nextConfig;
