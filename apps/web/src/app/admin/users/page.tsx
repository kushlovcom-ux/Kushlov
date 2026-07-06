'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PublicUser, Paginated } from '@kushlov/types';
import { api, apiError, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/app/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/common/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', q],
    queryFn: () => unwrap<Paginated<PublicUser>>(api.get('/admin/users', { params: { q, limit: 50 } })),
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

  const statusVariant = (s: string) =>
    s === 'active' ? 'success' : s === 'banned' ? 'destructive' : 'warning';

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage all accounts"
        action={
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="max-w-xs" />
        }
      />
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
                    <div className="flex justify-end gap-2">
                      {u.status !== 'active' && (
                        <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: u.id, status: 'active' })}>
                          Activate
                        </Button>
                      )}
                      {u.status === 'active' && (
                        <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: u.id, status: 'suspended' })}>
                          Suspend
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => setStatus.mutate({ id: u.id, status: 'banned' })}>
                        Ban
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
