import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { callsApi } from '@/api/calls';
import {
  CALL_ACTION_ACCEPT,
  CALL_ACTION_DECLINE,
  addNotificationResponseListener,
  dismissIncomingCallNotification,
  presentIncomingCallNotification,
  setupCallNotifications,
} from '@/services/notifications';
import { useAuthStore } from '@/store/auth';
import { useCallStore } from '@/store/call';
import { CallStatus } from '@/types';
import { haptics } from '@/utils/haptics';

/**
 * Polls for ringing invites + wires notification Accept/Decline actions.
 * Complements socket `call:invite` when the socket is briefly offline.
 */
export function useIncomingCallWatcher() {
  const token = useAuthStore((s) => s.accessToken);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const setHeldCall = useCallStore((s) => s.setHeldCall);
  const startCall = useCallStore((s) => s.startCall);
  const notifiedId = useRef<string | null>(null);

  useEffect(() => {
    void setupCallNotifications();
  }, []);

  useEffect(() => {
    if (!token) return;

    const ringIfNeeded = async (
      callId: string,
      callType: string,
      callerName?: string,
      interrupt?: boolean,
      callerAvatar?: string,
    ) => {
      if (notifiedId.current === callId) return;
      notifiedId.current = callId;
      haptics.medium();
      if (AppState.currentState !== 'active') {
        await presentIncomingCallNotification({
          callId,
          callType,
          callerName,
          callerAvatar,
          interrupt,
        });
      }
    };

    const syncIncoming = async () => {
      const { active, incoming } = useCallStore.getState();
      try {
        const { items } = await callsApi.incoming();
        const next = items[0] ?? null;
        if (!next?.id) {
          if (incoming) {
            setIncoming(null);
            await dismissIncomingCallNotification(incoming.id);
            notifiedId.current = null;
          }
          return;
        }
        // Allow call-waiting while already on a call; skip only non-interrupt when active.
        if (active && !next.interrupt) return;
        if (!incoming || incoming.id !== next.id) {
          setIncoming(next);
        }
        await ringIfNeeded(
          next.id,
          String(next.type),
          next.caller?.displayName,
          Boolean(next.interrupt),
          next.caller?.avatarUrl,
        );
      } catch {
        // soft fail
      }
    };

    void syncIncoming();
    const interval = setInterval(() => void syncIncoming(), 3500);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void syncIncoming();
      if (state !== 'active') {
        const incoming = useCallStore.getState().incoming;
        if (incoming?.id) {
          void presentIncomingCallNotification({
            callId: incoming.id,
            callType: String(incoming.type),
            callerName: incoming.caller?.displayName,
            callerAvatar: incoming.caller?.avatarUrl,
            interrupt: Boolean(incoming.interrupt),
          });
        }
      } else {
        const incoming = useCallStore.getState().incoming;
        if (incoming?.id) void dismissIncomingCallNotification(incoming.id);
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    let prevIncomingId = useCallStore.getState().incoming?.id ?? null;
    const unsubStore = useCallStore.subscribe((state) => {
      const nextId = state.incoming?.id ?? null;
      if (nextId && nextId !== prevIncomingId) {
        void ringIfNeeded(
          nextId,
          String(state.incoming?.type ?? 'audio'),
          state.incoming?.caller?.displayName,
          Boolean(state.incoming?.interrupt),
          state.incoming?.caller?.avatarUrl,
        );
      }
      if (!nextId && prevIncomingId) {
        void dismissIncomingCallNotification(prevIncomingId);
        if (notifiedId.current === prevIncomingId) notifiedId.current = null;
      }
      prevIncomingId = nextId;
    });

    return () => {
      clearInterval(interval);
      sub.remove();
      unsubStore();
    };
  }, [token, setIncoming]);

  useEffect(() => {
    if (!token) return;

    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as {
        kind?: string;
        callId?: string;
        callType?: string;
        interrupt?: boolean | string;
      };
      if (data?.kind !== 'incoming_call' || !data.callId || !data.callType) return;

      const callId = data.callId;
      const callType = data.callType;
      const action = response.actionIdentifier;
      void (async () => {
        if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          try {
            const { items } = await callsApi.incoming();
            const match = items.find((i) => i.id === callId) ?? items[0];
            if (match) setIncoming(match);
          } catch {
            // ignore
          }
          return;
        }

        if (action === CALL_ACTION_DECLINE) {
          try {
            await callsApi.reject(callType, callId);
          } catch {
            // ignore
          }
          setIncoming(null);
          await dismissIncomingCallNotification(callId);
          notifiedId.current = null;
          return;
        }

        if (action === CALL_ACTION_ACCEPT) {
          try {
            const incoming = useCallStore.getState().incoming;
            const isInterrupt =
              data.interrupt === true ||
              data.interrupt === 'true' ||
              Boolean(incoming?.interrupt);
            const session = isInterrupt
              ? await callsApi.acceptInterrupt(callType, callId)
              : await callsApi.accept(callType, callId);
            const active = useCallStore.getState().active;
            if (active && (incoming?.interrupt || session.heldCallId)) {
              setHeldCall({
                callId: session.heldCallId || active.session.id,
                type: session.heldType ?? active.session.type,
                peer: active.peer,
              });
              startCall(
                { ...session, status: CallStatus.Ongoing },
                'callee',
                incoming?.caller ?? session.caller,
              );
              setIncoming(null);
            } else {
              startCall(
                { ...session, status: CallStatus.Ongoing },
                'callee',
                incoming?.caller ?? session.caller,
              );
              setIncoming(null);
            }
            await dismissIncomingCallNotification(data.callId);
            notifiedId.current = null;
          } catch {
            try {
              const { items } = await callsApi.incoming();
              const match = items.find((i) => i.id === data.callId);
              if (match) setIncoming(match);
            } catch {
              // ignore
            }
          }
        }
      })();
    });

    return () => sub.remove();
  }, [token, setIncoming, startCall]);
}
