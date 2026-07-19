'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Role, type PublicUser, type Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

type RoleFilter = 'all' | 'user' | 'host';

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<PublicUser | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', q, role],
    queryFn: () =>
      unwrap<Paginated<PublicUser>>(
        api.get('/admin/users', {
          params: {
            q: q || undefined,
            role: role === 'all' ? undefined : role,
            limit: 50,
          },
        }),
      ),
  });

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

  const statusVariant = (s: string) =>
    s === 'active' ? 'success' : s === 'banned' ? 'destructive' : 'warning';

  const filters: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'user', label: 'Normal users' },
    { id: 'host', label: 'Hosts' },
  ];

  const canConfirmDelete =
    !!deleteTarget &&
    (confirmText === 'DELETE' ||
      confirmText.toLowerCase() === deleteTarget.username.toLowerCase());

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={
          role === 'user'
            ? 'Manage normal user accounts'
            : role === 'host'
              ? 'Manage host accounts'
              : 'Manage all accounts'
        }
        action={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
            onClick={() => setRole(f.id)}
          >
            {f.label}
            {role === f.id && data != null && (
              <span className="ml-1.5 text-xs opacity-80">({data.total})</span>
            )}
          </Button>
        ))}
      </div>

      <div className="p-6">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/50">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="p-4">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              )}
              {data?.items.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.displayName} src={u.avatarUrl} className="h-9 w-9" />
                      <div>
                        <p className="font-medium">{u.displayName}</p>
                        <p className="text-xs text-white/40">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 capitalize">{u.role}</td>
                  <td className="p-4">
                    <Badge variant={statusVariant(u.status) as any}>{u.status}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      {u.status !== 'active' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus.mutate({ id: u.id, status: 'active' })}
                        >
                          Activate
                        </Button>
                      )}
                      {u.status === 'active' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus.mutate({ id: u.id, status: 'suspended' })}
                        >
                          Suspend
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setStatus.mutate({ id: u.id, status: 'banned' })}
                      >
                        Ban
                      </Button>
                      {u.role !== Role.Admin && (
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
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-white/40">
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
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
