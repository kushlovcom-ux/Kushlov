import { useEffect, useState } from 'react';
import type { Room } from 'livekit-client';
import { callsApi } from '@/api/calls';
import { useCallStore } from '@/store/call';
import { CallStatus } from '@/types';
import type { CallSession } from '@/types';

const POLL_MS = 1500;

function isOngoing(status: unknown): boolean {
  const value = String(status ?? '').toLowerCase();
  return value === CallStatus.Ongoing || value === 'ongoing';
}

function rosterOf(session: CallSession) {
  return (session.participants ?? [])
    .filter((p) => p.id)
    .map((p) => ({ id: p.id, name: p.displayName || p.name || 'Peer' }));
}

/**
 * Move the client into the room the server says it belongs to.
 *
 * Hold / merge / call-waiting all hand a peer a new LiveKit room, and until now
 * that hand-off only ever arrived over a socket. A dropped `call:accept` or
 * `call:unhold` left the peer alone in the room the merge had already emptied,
 * which is what surfaced as "Waiting for peer" / "Connecting video". The server
 * records the canonical conference on the leg it retires, so asking about our
 * own call id is enough to find the room that actually has the media.
 */
export function useCallRoomReconciler(room: Room | null) {
  const parked = useCallStore((s) => s.parked);
  const parkedConsult = useCallStore((s) => s.parkedConsult);
  const sessionId = useCallStore((s) => s.active?.session.id);
  const sessionType = useCallStore((s) => s.active?.session.type);
  const sessionStatus = useCallStore((s) => s.active?.session.status);
  const roomName = useCallStore((s) => s.active?.session.roomName);
  const [alone, setAlone] = useState(true);

  useEffect(() => {
    if (!room) {
      setAlone(true);
      return;
    }
    const update = () => setAlone(room.remoteParticipants.size === 0);
    update();
    room.on('participantConnected', update);
    room.on('participantDisconnected', update);
    room.on('connectionStateChanged', update);
    return () => {
      room.off('participantConnected', update);
      room.off('participantDisconnected', update);
      room.off('connectionStateChanged', update);
    };
  }, [room]);

  // Parked peers have no room at all, so they are always candidates.
  const stranded = Boolean(
    sessionId && isOngoing(sessionStatus) && (parked || parkedConsult || alone),
  );

  useEffect(() => {
    if (!stranded || !sessionId || !sessionType) return;
    let cancelled = false;

    /**
     * Adopt a conference only when it is a genuinely different room. Tokens are
     * minted per request, so re-adopting the same room would remount LiveKit on
     * every poll and cut the audio we are trying to keep.
     */
    const adopt = (next: CallSession): boolean => {
      if (cancelled) return false;
      const state = useCallStore.getState();
      const current = state.active;
      if (!current) return false;
      if (!next.token || !next.livekitUrl) return false;
      if (!isOngoing(next.status)) return false;
      if (!next.roomName || next.roomName === current.session.roomName) return false;

      const previousId = current.session.id;
      useCallStore.setState({
        active: {
          ...current,
          session: {
            ...current.session,
            id: next.id || current.session.id,
            type: next.type || current.session.type,
            token: next.token,
            livekitUrl: next.livekitUrl,
            roomName: next.roomName,
            status: CallStatus.Ongoing,
          },
        },
        parked: false,
        parkedConsult: null,
      });
      const roster = rosterOf(next);
      if (roster.length) useCallStore.getState().setParticipants(roster);
      useCallStore.getState().markConnected();

      // The leg we just left is gone; keeping it as "on hold" would offer a
      // merge that can never happen.
      const held = useCallStore.getState().heldCall;
      const retiredIds = [previousId, next.mergedFromHold].filter(Boolean).map(String);
      if (held && retiredIds.includes(String(held.callId))) {
        useCallStore.getState().setHeldCall(null);
      }
      return true;
    };

    const tick = async () => {
      const state = useCallStore.getState();
      if (!state.active) return;
      const current = state.active.session;

      // 1. Our own id. The server redirects a merged-away leg to the conference.
      try {
        const mine = await callsApi.get(current.type, current.id);
        if (cancelled) return;
        if (adopt(mine)) return;
      } catch {
        /* forbidden / gone — fall through */
      }

      // 2. The consult the holder switched to, if `call:hold` told us about it.
      const consult = useCallStore.getState().parkedConsult;
      if (consult?.callId) {
        try {
          const conf = await callsApi.get(consult.type, consult.callId);
          if (cancelled) return;
          if (adopt(conf)) return;
        } catch {
          /* not a member yet — the merge has not run */
        }
      }

      // 3. Last resort, and only while we know a hand-off is in flight: any
      //    other ongoing call we are a member of. Never for a plain 1:1, where
      //    an unrelated stale row could hijack the call.
      if (!useCallStore.getState().parked && !consult) return;
      try {
        const { items } = await callsApi.active();
        if (cancelled) return;
        const conf = items.find(
          (item) =>
            item.id &&
            String(item.id) !== String(current.id) &&
            Boolean(item.token) &&
            isOngoing(item.status),
        );
        if (conf) adopt(conf);
      } catch {
        /* still waiting */
      }
    };

    const timer = setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stranded, sessionId, sessionType, roomName]);
}
