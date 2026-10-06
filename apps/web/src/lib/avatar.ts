/**
 * Returns a high-quality, deterministic premium avatar URL when a user does not have a profile photo.
 * Powered by DiceBear Lorelei modern illustrated character portraits with warm soft gradient backgrounds.
 */
export function getPremiumAvatar(seed?: string, id?: string): string {
  const raw = (seed || id || 'kushlov-user').trim().toLowerCase();
  const cleanSeed = encodeURIComponent(raw);
  return `https://api.dicebear.com/9.x/lorelei/png?seed=${cleanSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&size=512`;
}
