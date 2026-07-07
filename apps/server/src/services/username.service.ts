import { User } from '../models';

/** Derive a unique username from an email local-part or display name. */
export async function generateUniqueUsername(source: string): Promise<string> {
  const base =
    source
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20) || 'user';

  let candidate = base;
  let suffix = 0;
  while (await User.exists({ username: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 30);
  }
  return candidate;
}
