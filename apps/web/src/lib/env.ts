/** Hosted API that stays up when the VPS PM2 process behind nginx is down. */
const HOSTED_API_URL = 'https://kushlov-server.vercel.app';

/** Production site hosts that historically used same-origin `/api` via nginx → :5000. */
const SAME_ORIGIN_SITE_HOSTS = new Set([
  'klproind.com',
  'www.klproind.com',
  'genzone.cloud',
  'www.genzone.cloud',
]);

/**
 * When NEXT_PUBLIC_API_URL points at the public site (same-origin nginx proxy)
 * but the local Express process is down, browsers get 502s. Route those builds
 * to the working Vercel API instead (CORS + cookie SameSite=none already allow it).
 */
function resolveApiUrl(configured: string): string {
  try {
    const host = new URL(configured).hostname.toLowerCase();
    if (SAME_ORIGIN_SITE_HOSTS.has(host)) return HOSTED_API_URL;
  } catch {
    /* keep configured */
  }
  return configured;
}

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const apiUrl = resolveApiUrl(configuredApiUrl);

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// Keep sockets on the public site host when possible — Vercel cannot host Socket.io.
const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (SAME_ORIGIN_SITE_HOSTS.has(hostnameOf(configuredApiUrl)) ? configuredApiUrl : apiUrl);

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
  apiUrl,
  socketUrl,
  socketEnabled: computeSocketEnabled(socketUrl),
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? '',
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  /** Meta Pixel ID (public). Override with NEXT_PUBLIC_META_PIXEL_ID if needed. */
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '2887900641565745',
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
