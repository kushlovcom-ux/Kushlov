/** Session handoff so Accept can pass a publish token into the live room. */

const key = (liveId: string) => `kushlov:colive-token:${liveId}`;

export type ColiveHandoff = {
  token: string;
  livekitUrl?: string;
};

export function storeColiveHandoff(liveId: string, data: ColiveHandoff): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key(liveId), JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function takeColiveHandoff(liveId: string): ColiveHandoff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key(liveId));
    if (!raw) return null;
    sessionStorage.removeItem(key(liveId));
    const parsed = JSON.parse(raw) as ColiveHandoff;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}
