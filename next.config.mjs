/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les pochettes sont affichées directement depuis i.discogs.com (balises <img>), jamais copiées ni retraitées.
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }];
  },
};
export default nextConfig;
