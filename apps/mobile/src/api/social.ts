import { apiDelete, apiGet, apiPost } from './client';
import type { Paginated, PublicUser } from '@/types';

/** A row from an endpoint that returns users, in any of the shapes it has had. */
type UserRow = (Partial<PublicUser> & { _id?: string }) | { user?: Partial<PublicUser> & { _id?: string } };

/**
 * `/social/matches` wraps each user in `{ matchId, matchedAt, user }`, and older
 * builds of the API serialise users with `_id` instead of `id`. The screens only
 * ever want a plain `PublicUser`, and one without an `id` renders as a blank
 * card, so flatten and fill in the id here.
 */
function toUser(row: UserRow): PublicUser | null {
  const raw = ('user' in row && row.user ? row.user : row) as Partial<PublicUser> & {
    _id?: string;
  };
  const id = raw.id || raw._id;
  if (!id) return null;
  return { ...raw, id } as PublicUser;
}

function toUsers(page: Paginated<UserRow>): Paginated<PublicUser> {
  return { ...page, items: (page.items ?? []).map(toUser).filter(Boolean) as PublicUser[] };
}

export const socialApi = {
  like: (userId: string) =>
    apiPost<{ matched?: boolean; like?: unknown }>(`/social/like/${userId}`),
  unlike: (userId: string) => apiDelete<{ ok: boolean }>(`/social/like/${userId}`),
  matches: async (params?: { page?: number; limit?: number }) =>
    toUsers(await apiGet<Paginated<UserRow>>('/social/matches', { params })),
  likes: async (params?: { page?: number; limit?: number }) =>
    toUsers(await apiGet<Paginated<UserRow>>('/social/likes', { params })),
  follow: (userId: string) => apiPost<{ ok: boolean }>(`/social/follow/${userId}`),
  unfollow: (userId: string) => apiDelete<{ ok: boolean }>(`/social/follow/${userId}`),
  following: async (params?: { page?: number; limit?: number }) =>
    toUsers(await apiGet<Paginated<UserRow>>('/social/following', { params })),
};
