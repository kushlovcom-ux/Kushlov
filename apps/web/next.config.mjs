/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile shared workspace packages that ship TypeScript source.
  transpilePackages: ['@kushlov/ui', '@kushlov/types', '@kushlov/utils'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'cdn.kushlov.app' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
