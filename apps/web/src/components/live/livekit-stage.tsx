'use client';

import '@livekit/components-styles';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { clientEnv } from '@/lib/env';

/**
 * Thin wrapper around LiveKit's prebuilt conference UI. Used for both 1:1 calls
 * and live-stream rooms. `serverUrl` falls back to the public env value.
 */
export function LiveKitStage({
  token,
  serverUrl,
  onDisconnected,
  audioOnly = false,
}: {
  token: string;
  serverUrl?: string;
  onDisconnected?: () => void;
  audioOnly?: boolean;
}) {
  const url = serverUrl || clientEnv.livekitUrl;
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-card p-8 text-center text-white/50">
        LiveKit is not configured. Set NEXT_PUBLIC_LIVEKIT_URL to enable calls & live streams.
      </div>
    );
  }
  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      video={!audioOnly}
      audio
      onDisconnected={onDisconnected}
      data-lk-theme="default"
      style={{ height: '100%', borderRadius: '1rem', overflow: 'hidden' }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
