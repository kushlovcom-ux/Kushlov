/** Client-safe environment configuration (all values are public). */
export const clientEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000',
  socketUrl:
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:5000',
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? '',
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
};

export const API_BASE = `${clientEnv.apiUrl}/api`;
