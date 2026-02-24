/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow embedding in iframes
  async headers() {
    return [
      {
        source: '/embed',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors *',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
