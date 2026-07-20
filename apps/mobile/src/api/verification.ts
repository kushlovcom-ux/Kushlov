import { api, apiGet, apiPost } from './client';
import type { Gender, VerificationStatus, VerificationStep } from '@/types';

export type VerificationState = {
  status: VerificationStatus | string;
  step?: VerificationStep | string;
  name?: string;
  notes?: string;
  [key: string]: unknown;
};

export const verificationApi = {
  instructions: () =>
    apiGet<{ items: Array<{ id: string; title: string; body: string }> }>(
      '/verification/instructions',
    ),
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
  submitIdentity: async (files: { selfieUris: string[]; videoUri?: string }) => {
    const form = new FormData();
    files.selfieUris.forEach((uri, i) => {
      form.append('selfies', {
        uri,
        type: 'image/jpeg',
        name: `selfie-${i}.jpg`,
      } as unknown as Blob);
    });
    if (files.videoUri) {
      form.append('video', {
        uri: files.videoUri,
        type: 'video/mp4',
        name: 'identity.mp4',
      } as unknown as Blob);
    }
    const res = await api.post('/verification/identity', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as VerificationState;
  },
};
