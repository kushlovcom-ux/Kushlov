/** Decode a JWT payload without verifying the signature (client-side expiry check). */
export function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    const json = globalThis.atob(padded);
    return JSON.parse(json) as { exp?: number; sub?: string };
  } catch {
    return null;
  }
}

/** Milliseconds until the access token expires. Null if unknown. */
export function accessTokenMsRemaining(token: string | null | undefined): number | null {
  if (!token) return null;
  const exp = decodeJwtPayload(token)?.exp;
  if (typeof exp !== 'number') return null;
  return exp * 1000 - Date.now();
}
