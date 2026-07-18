'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthBootstrap } from './auth-bootstrap';
import { CookieConsent } from './cookie-consent';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
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
