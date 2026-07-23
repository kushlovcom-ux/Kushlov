import { create } from 'zustand';
import type { FaceMaskId } from '@/constants/faceMasks';

/** Local optimistic face-mask selection (works even if LiveKit attributes fail). */
type FaceMaskStore = {
  localMaskId: FaceMaskId | '';
  setLocalMaskId: (id: FaceMaskId | '') => void;
};

export const useFaceMaskStore = create<FaceMaskStore>((set) => ({
  localMaskId: '',
  setLocalMaskId: (localMaskId) => set({ localMaskId }),
}));
