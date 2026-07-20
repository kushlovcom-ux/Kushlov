import { create } from 'zustand';
import type { CallSession, CallType, PublicUser } from '@/types';

export type ActiveCall = {
  session: CallSession;
  role: 'caller' | 'callee';
  peer?: PublicUser;
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  connectedAt?: number;
};

type CallState = {
  active: ActiveCall | null;
  incoming: CallSession | null;
  setIncoming: (call: CallSession | null) => void;
  startCall: (session: CallSession, role: 'caller' | 'callee', peer?: PublicUser) => void;
  updateSession: (session: Partial<CallSession>) => void;
  setMuted: (muted: boolean) => void;
  setCameraOff: (cameraOff: boolean) => void;
  setSpeakerOn: (speakerOn: boolean) => void;
  markConnected: () => void;
  clear: () => void;
};

export const useCallStore = create<CallState>((set, get) => ({
  active: null,
  incoming: null,
  setIncoming: (incoming) => set({ incoming }),
  startCall: (session, role, peer) =>
    set({
      incoming: null,
      active: {
        session,
        role,
        peer,
        muted: false,
        cameraOff: session.type === ('audio' as CallType),
        speakerOn: session.type === ('audio' as CallType),
        connectedAt: undefined,
      },
    }),
  updateSession: (partial) => {
    const active = get().active;
    if (!active) return;
    set({ active: { ...active, session: { ...active.session, ...partial } } });
  },
  setMuted: (muted) => {
    const active = get().active;
    if (!active) return;
    set({ active: { ...active, muted } });
  },
  setCameraOff: (cameraOff) => {
    const active = get().active;
    if (!active) return;
    set({ active: { ...active, cameraOff } });
  },
  setSpeakerOn: (speakerOn) => {
    const active = get().active;
    if (!active) return;
    set({ active: { ...active, speakerOn } });
  },
  markConnected: () => {
    const active = get().active;
    if (!active) return;
    set({ active: { ...active, connectedAt: Date.now() } });
  },
  clear: () => set({ active: null, incoming: null }),
}));
