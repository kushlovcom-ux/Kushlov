'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { clientEnv } from '@/lib/env';

interface PublicSettings {
  livekitEnabled?: boolean;
  livekitUrl?: string | null;
}

/** Resolve LiveKit WebSocket URL from env or the public settings API. */
export function useLiveKitUrl() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => unwrap<PublicSettings>(api.get('/settings')),
    staleTime: 5 * 60_000,
  });

  const url = clientEnv.livekitUrl || data?.livekitUrl || '';

  return {
    url,
    enabled: Boolean(url) || Boolean(data?.livekitEnabled),
    isLoading: isLoading && !clientEnv.livekitUrl,
  };
}
