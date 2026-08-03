import { api, apiGet, apiPost } from './client';
import type { Gender, VerificationStatus, VerificationStep } from '@/types';

export type VerificationState = {
  status: VerificationStatus | string;
  step?: VerificationStep | string;
  name?: string;
  notes?: string;
  [key: string]: unknown;
};

export type VerificationInstruction = {
  _id?: string;
  id?: string;
  text: string;
  category: 'selfie' | 'video' | 'general' | string;
  sortOrder?: number;
  isActive?: boolean;
};

export const verificationApi = {
  instructions: () => apiGet<VerificationInstruction[]>('/verification/instructions'),
  me: () => apiGet<VerificationState | null>('/verification/me'),
  submitBasic: (body: {
    name: string;
    username: string;
    bio?: string;
    gender: Gender;
    dob: string;
    languages?: string[];
    country: string;
  }) => apiPost<VerificationState>('/verification/basic', body),
  submitDocuments: async (files: {
    governmentIdUri: string;
    addressProofUri?: string;
  }) => {
    const form = new FormData();
    form.append('governmentId', {
      uri: files.governmentIdUri,
      type: 'image/jpeg',
      name: 'government-id.jpg',
    } as unknown as Blob);
    if (files.addressProofUri) {
      form.append('addressProof', {
        uri: files.addressProofUri,
        type: 'image/jpeg',
        name: 'address-proof.jpg',
      } as unknown as Blob);
    }
    const res = await api.post('/verification/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as VerificationState;
  },
  submitIdentity: async (files: {
    selfieUris: string[];
    selfieInstructions: string[];
    videoUri: string;
    videoInstruction: string;
  }) => {
    const form = new FormData();
    files.selfieUris.forEach((uri, i) => {
      form.append('selfies', {
        uri,
        type: 'image/jpeg',
        name: `live-selfie-${i + 1}.jpg`,
      } as unknown as Blob);
      form.append('instructions', files.selfieInstructions[i] ?? `Selfie ${i + 1}`);
    });
    const isMp4 = files.videoUri.toLowerCase().includes('.mp4');
    form.append('video', {
      uri: files.videoUri,
      type: isMp4 ? 'video/mp4' : 'video/mp4',
      name: isMp4 ? 'live-verification.mp4' : 'live-verification.mp4',
    } as unknown as Blob);
    form.append('videoInstruction', files.videoInstruction);
    const res = await api.post('/verification/identity', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as VerificationState;
  },
};
