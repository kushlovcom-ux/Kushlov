'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Role, type PublicUser, type Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PageHeader } from '@/components/app/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { UserAvatar } from '@/components/common/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type RoleFilter = 'all' | 'user' | 'host' | 'subadmin';

const PAGE_SIZE = 50;

function userIdOf(u: PublicUser & { _id?: string }): string {
  return u.id || u._id || '';
}

function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [q, setQ] = useState('');
  const roleFromUrl = searchParams.get('role');
  const subadminFromUrl = searchParams.get('subadmin');
  const [role, setRole] = useState<RoleFilter>(
    subadminFromUrl === 'true' || subadminFromUrl === '1'
      ? 'subadmin'
      : roleFromUrl === 'user' || roleFromUrl === 'host'
        ? roleFromUrl
        : 'all',
  );
  const [deleteTarget, setDeleteTarget] = useState<PublicUser | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);

  const replaceQuery = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `/admin/users?${qs}` : '/admin/users');
  };

  useEffect(() => {
    if (searchParams.get('subadmin') === 'true' || searchParams.get('subadmin') === '1') {
      setRole('subadmin');
      return;
    }
    const r = searchParams.get('role');
    if (r === 'user' || r === 'host') setRole(r);
    else setRole('all');
  }, [searchParams]);

  const applyRole = (next: RoleFilter) => {
    setRole(next);
    replaceQuery((params) => {
      params.delete('role');
      params.delete('subadmin');
      params.delete('page');
      if (next === 'user' || next === 'host') params.set('role', next);
      if (next === 'subadmin') params.set('subadmin', 'true');
    });
  };

  const goToPage = (next: number) => {
    replaceQuery((params) => {
      if (next <= 1) params.delete('page');
      else params.set('page', String(next));
    });
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-users', q, role, page],
    queryFn: () =>
      unwrap<Paginated<PublicUser>>(
        api.get('/admin/users', {
          params: {
            q: q || undefined,
            role: role === 'user' || role === 'host' ? role : undefined,
            subadmin: role === 'subadmin' ? true : undefined,
            page,
            limit: PAGE_SIZE,
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!data) return;
    if (data.totalPages > 0 && page > data.totalPages) goToPage(data.totalPages);
  }, [data, page]);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User permanently deleted');
      setDeleteTarget(null);
      setConfirmText('');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-online'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const setPopular = useMutation({
    mutationFn: ({ id, isPopularHost }: { id: string; isPopularHost: boolean }) =>
      api.patch(`/admin/hosts/${id}/popular`, { isPopularHost }),
    onSuccess: () => {
      toast.success('Popular updated');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const statusVariant = (s: string) =>
    s === 'active' ? 'success' : s === 'banned' ? 'destructive' : 'warning';

  const filters: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'user', label: 'Normal users' },
    { id: 'host', label: 'Hosts' },
    { id: 'subadmin', label: 'Subadmins' },
  ];

  const canConfirmDelete =
    !!deleteTarget &&
    (confirmText === 'DELETE' ||
      confirmText.toLowerCase() === deleteTarget.username.toLowerCase());

  const openDetails = (u: PublicUser) => {
    const id = userIdOf(u);
    if (!id) {
      toast.error('Missing user id');
      return;
    }
    router.push(`/admin/users/${id}`);
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Open details to edit profile. Toggle Popular to feature users on web and app home."
        action={
          <Input
            value={q}
            onChange={(e) => {
              const next = e.target.value;
              setQ(next);
              if (page !== 1) goToPage(1);
            }}
            placeholder="Search…"
            className="max-w-xs"
          />
        }
      />

      <div className="flex flex-wrap gap-2 px-6 pt-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={role === f.id ? 'default' : 'secondary'}
            className={cn(role === f.id && 'bg-brand-gradient')}
            onClick={() => applyRole(f.id)}
          >
            {f.label}
            {role === f.id && data != null && (
              <span className="ml-1.5 text-xs opacity-80">({data.total})</span>
            )}
          </Button>
        ))}
      </div>

      <div className="p-6">
        <div className={cn('overflow-hidden rounded-2xl border border-white/10', isFetching && 'opacity-70')}>
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/50">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Popular</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-4">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              )}
              {data?.items.map((u) => {
                const id = userIdOf(u);
                const canMarkPopular =
                  u.role === Role.User || (u.role === Role.Host && u.isHostApproved);
                return (
                  <tr
                    key={id || u.email}
                    className="border-t border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => openDetails(u)}
                        className="flex items-center gap-3 text-left hover:opacity-90"
                      >
                        <UserAvatar name={u.displayName} src={u.avatarUrl} className="h-9 w-9" />
                        <div>
                          <p className="font-medium">{u.displayName}</p>
                          <p className="text-xs text-white/40">{u.email}</p>
                        </div>
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="capitalize">{u.role}</span>
                        {u.isSubadmin ? <Badge variant="secondary">Subadmin</Badge> : null}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusVariant(u.status) as any}>{u.status}</Badge>
                    </td>
                    <td className="p-4">
                      {canMarkPopular ? (
                        <Switch
                          checked={!!u.isPopularHost}
                          disabled={setPopular.isPending}
                          onCheckedChange={(v) =>
                            setPopular.mutate({ id, isPopularHost: v })
                          }
                        />
                      ) : (
                        <span className="text-xs text-white/35">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-brand-gradient"
                          onClick={() => openDetails(u)}
                        >
                          <Eye className="h-4 w-4" />
                          Open details
                        </Button>
                        {u.role !== Role.Admin && (me?.role === Role.Admin || !u.isSubadmin) && (
                          <>
                            {u.status !== 'active' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setStatus.mutate({ id, status: 'active' })}
                              >
                                Activate
                              </Button>
                            )}
                            {u.status === 'active' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setStatus.mutate({ id, status: 'suspended' })}
                              >
                                Suspend
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setStatus.mutate({ id, status: 'banned' })}
                            >
                              Ban
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setConfirmText('');
                                setDeleteTarget(u);
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-white/40">
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/55">
            <p>
              Showing{' '}
              <span className="text-white/80">
                {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)}
              </span>{' '}
              of <span className="text-white/80">{data.total}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!data.hasPrev || isFetching}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="min-w-[4.5rem] text-center text-white/70">
                {data.page} / {data.totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={!data.hasNext || isFetching}
                onClick={() => goToPage(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setConfirmText('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This removes <strong className="text-white">{deleteTarget?.displayName}</strong> (
              @{deleteTarget?.username}) and all related data (profile, wallet, messages, calls,
              reviews, verification, etc.). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-white/55">
              Type <span className="font-mono text-white">DELETE</span> or the username to confirm.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                loading={remove.isPending}
                disabled={!canConfirmDelete}
                onClick={() => deleteTarget && remove.mutate(userIdOf(deleteTarget))}
              >
                Delete forever
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminUsersPageRoute() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <AdminUsersPage />
    </Suspense>
  );
}
