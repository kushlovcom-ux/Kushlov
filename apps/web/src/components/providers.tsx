'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { SocketProvider } from './socket-provider';
import { AuthBootstrap } from './auth-bootstrap';
import { CookieConsent } from './cookie-consent';
import { CallOverlay } from './calls/call-overlay';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
      <QueryClientProvider client={client}>
        <AuthBootstrap />
        <SocketProvider>
          {children}
          <CallOverlay />
        </SocketProvider>
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
