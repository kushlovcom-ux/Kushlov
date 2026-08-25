import { z } from 'zod';
import { Gender, InterestedIn } from '@kushlov/types';

export const updateMeSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  bio: z.string().max(500).optional(),
  gender: z.nativeEnum(Gender).optional(),
  country: z.string().min(2).max(80).optional(),
});

export const updateProfileSchema = z.object({
  dob: z.coerce.date().optional(),
  gender: z.nativeEnum(Gender).optional(),
  interestedIn: z.nativeEnum(InterestedIn).optional(),
  languages: z.array(z.string()).max(20).optional(),
  country: z.string().max(60).optional(),
  city: z.string().max(60).optional(),
  interests: z.array(z.string()).max(30).optional(),
  height: z.number().min(50).max(260).optional(),
  occupation: z.string().max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  preferences: z
    .object({
      ageMin: z.number().min(18).max(100),
      ageMax: z.number().min(18).max(100),
      maxDistanceKm: z.number().min(1).max(20000),
    })
    .partial()
    .optional(),
});

export const registerPushTokenSchema = z.object({
  token: z.string().min(20).max(200),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  deviceId: z.string().min(4).max(80).optional(),
});

export const clearPushTokenSchema = z.object({
  token: z.string().min(20).max(200).optional(),
});

export const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  locationLabel: z.string().max(200).optional(),
});
