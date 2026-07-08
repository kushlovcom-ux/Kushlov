const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:5000';

/**
 * Vercel serverless functions cannot host a persistent WebSocket/Socket.io
 * server, so connecting to a *.vercel.app host just 404s and retries forever.
 * Disable sockets in that case. Override explicitly with
 * NEXT_PUBLIC_ENABLE_SOCKET=true once a real socket server is hosted elsewhere.
 */
function computeSocketEnabled(url: string): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_SOCKET;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  try {
    return !/\.vercel\.app$/i.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

/** Client-safe environment configuration (all values are public). */
export const clientEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000',
  socketUrl,
  socketEnabled: computeSocketEnabled(socketUrl),
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? '',
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
  },
};

export const isFirebaseClientConfigured = (): boolean =>
  Boolean(
    clientEnv.firebase.apiKey &&
      clientEnv.firebase.authDomain &&
      clientEnv.firebase.projectId &&
      clientEnv.firebase.appId,
  );

export const API_BASE = `${clientEnv.apiUrl}/api`;
