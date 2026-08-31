import { create } from 'zustand';
import type { CallSession, CallType, PublicUser } from '@/types';

export type ActiveCall = {
  session: CallSession;
  role: 'caller' | 'callee';
  peer?: PublicUser;
  /** Remotes on this leg — used for End-for-X controls. */
  participants: { id: string; name: string }[];
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  connectedAt?: number;
};

export type HeldCall = {
  callId: string;
  type: CallType;
  peer?: PublicUser;
};

type CallState = {
  active: ActiveCall | null;
  incoming: CallSession | null;
  heldCall: HeldCall | null;
  parked: boolean;
  setIncoming: (call: CallSession | null) => void;
  setHeldCall: (held: HeldCall | null) => void;
  setParked: (parked: boolean) => void;
  startCall: (session: CallSession, role: 'caller' | 'callee', peer?: PublicUser) => void;
  updateSession: (session: Partial<CallSession>) => void;
  setParticipants: (participants: { id: string; name: string }[]) => void;
  setMuted: (muted: boolean) => void;
  setCameraOff: (cameraOff: boolean) => void;
  setSpeakerOn: (speakerOn: boolean) => void;
  markConnected: () => void;
  clear: () => void;
};

export const useCallStore = create<CallState>((set, get) => ({
  active: null,
  incoming: null,
  heldCall: null,
  parked: false,
  setIncoming: (incoming) => set({ incoming }),
  setHeldCall: (heldCall) => set({ heldCall }),
  setParked: (parked) => set({ parked }),
  startCall: (session, role, peer) => {
    const fromSession = (session.participants ?? [])
      .filter((p) => p.id)
      .map((p) => ({ id: p.id, name: p.displayName || p.name || 'Peer' }));
    const participants = fromSession.length
      ? fromSession
      : peer?.id
        ? [{ id: peer.id, name: peer.displayName ?? 'Peer' }]
        : [];
    const first = participants[0];
    set({
      incoming: null,
      parked: false,
      active: {
        session,
        role,
        peer: peer ?? (first
          ? ({ id: first.id, displayName: first.name } as PublicUser)
          : undefined),
        participants,
        muted: false,
        cameraOff: session.type === ('audio' as CallType),
        speakerOn: session.type === ('audio' as CallType),
        connectedAt: undefined,
      },
    });
  },
  updateSession: (partial) => {
    const active = get().active;
    if (!active) return;
    set({ active: { ...active, session: { ...active.session, ...partial } } });
  },
  setParticipants: (participants: { id: string; name: string }[]) => {
    const active = get().active;
    if (!active) return;
    set({
      active: {
        ...active,
        participants,
        peer: participants[0]
          ? { ...(active.peer ?? { id: participants[0].id }), id: participants[0].id, displayName: participants[0].name }
          : active.peer,
      },
    });
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
  clear: () => set({ active: null, incoming: null, heldCall: null, parked: false }),
}));
