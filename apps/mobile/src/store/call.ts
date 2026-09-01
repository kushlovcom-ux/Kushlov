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

/** Consult/conference the holder switched to while we are parked. */
export type ParkedConsult = {
  callId: string;
  type: CallType;
};

type CallState = {
  active: ActiveCall | null;
  incoming: CallSession | null;
  heldCall: HeldCall | null;
  parked: boolean;
  /** Set from `call:hold` so a parked peer can HTTP-join after merge. */
  parkedConsult: ParkedConsult | null;
  setIncoming: (call: CallSession | null) => void;
  setHeldCall: (held: HeldCall | null) => void;
  setParked: (parked: boolean) => void;
  setParkedConsult: (consult: ParkedConsult | null) => void;
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
  parkedConsult: null,
  setIncoming: (incoming) => set({ incoming }),
  setHeldCall: (heldCall) => set({ heldCall }),
  setParked: (parked) => set({ parked }),
  setParkedConsult: (parkedConsult) => set({ parkedConsult }),
  startCall: (session, role, peer) => {
    const looksLikeId = (v?: string) => Boolean(v && /^[a-f0-9]{24}$/i.test(v.trim()));
    const labelOf = (p: { id: string; displayName?: string; name?: string }) => {
      const raw = p.displayName || p.name;
      if (raw && !looksLikeId(raw)) return raw;
      return 'Peer';
    };
    const fromSession = (session.participants ?? [])
      .filter((p) => p.id)
      .map((p) => ({ id: p.id, name: labelOf(p) }));
    const sessionPeer =
      role === 'caller'
        ? session.callee
        : session.caller ?? session.callee;
    const resolvedPeer =
      peer ??
      (sessionPeer?.id
        ? ({
            ...sessionPeer,
            displayName:
              sessionPeer.displayName && !looksLikeId(sessionPeer.displayName)
                ? sessionPeer.displayName
                : 'Peer',
          } as PublicUser)
        : undefined);
    const participants = fromSession.length
      ? fromSession
      : resolvedPeer?.id
        ? [
            {
              id: resolvedPeer.id,
              name:
                resolvedPeer.displayName && !looksLikeId(resolvedPeer.displayName)
                  ? resolvedPeer.displayName
                  : 'Peer',
            },
          ]
        : [];
    const first = participants[0];
    set({
      incoming: null,
      parked: false,
      parkedConsult: null,
      active: {
        session,
        role,
        peer: resolvedPeer ?? (first
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
    const looksLikeId = (v?: string) => Boolean(v && /^[a-f0-9]{24}$/i.test(v.trim()));
    const cleaned = participants.map((p) => ({
      ...p,
      name: p.name && !looksLikeId(p.name) ? p.name : 'Peer',
    }));
    const first = cleaned[0];
    const keepPeerName =
      active.peer?.displayName && !looksLikeId(active.peer.displayName)
        ? active.peer.displayName
        : undefined;
    set({
      active: {
        ...active,
        participants: cleaned,
        peer: first
          ? ({
              ...(active.peer ?? { id: first.id }),
              id: first.id,
              displayName:
                (first.name !== 'Peer' ? first.name : undefined) ||
                keepPeerName ||
                'Peer',
            } as PublicUser)
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
  clear: () =>
    set({
      active: null,
      incoming: null,
      heldCall: null,
      parked: false,
      parkedConsult: null,
    }),
}));
