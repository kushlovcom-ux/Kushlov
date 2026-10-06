/**
 * Generates a deterministic, premium illustrated avatar for users without a custom profile photo.
 * Uses PNG format for 100% native compatibility with React Native Image components.
 */
export function getPremiumAvatar(seed?: string, id?: string): string {
  const clean = encodeURIComponent((seed || id || 'kushlov-user').trim().toLowerCase());
  return `https://api.dicebear.com/9.x/lorelei/png?seed=${clean}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&size=256`;
}
