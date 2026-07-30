'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { isRateLimited } from '@/lib/api';
import { AuthBootstrap } from './auth-bootstrap';
import { CookieConsent } from './cookie-consent';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            // Never retry rate-limited or auth failures — retries amplify 429 storms.
            retry: (failureCount, error) => {
              if (isRateLimited(error)) return false;
              if (
                typeof error === 'object' &&
                error &&
                'response' in error &&
                (error as { response?: { status?: number } }).response?.status === 401
              ) {
                return false;
              }
              return failureCount < 1;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
      <QueryClientProvider client={client}>
        <AuthBootstrap />
        {children}
        <CookieConsent />
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: 'hsl(240 8% 10%)',
              border: '1px solid hsl(240 6% 18%)',
              color: '#fff',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
