import { create } from 'zustand';

export type ColiveInvite = {
  liveId: string;
  title?: string;
  from?: { displayName?: string; id?: string; avatarUrl?: string };
};

type ColiveStore = {
  invite: ColiveInvite | null;
  setInvite: (invite: ColiveInvite | null) => void;
};

export const useColiveStore = create<ColiveStore>((set) => ({
  invite: null,
  setInvite: (invite) => set({ invite }),
}));
