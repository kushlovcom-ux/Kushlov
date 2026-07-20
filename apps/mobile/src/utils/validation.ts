import { z } from 'zod';

export const emailSchema = z.string().trim().email('Enter a valid email');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(24, 'Username is too long')
  .regex(/^[a-zA-Z0-9._]+$/, 'Only letters, numbers, . and _');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    displayName: z.string().trim().min(2, 'Name is required').max(48),
    password: passwordSchema,
    confirmPassword: z.string(),
    country: z.string().min(2, 'Select a country'),
    accountType: z.enum(['user', 'host']).default('user'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const contactSchema = z.object({
  category: z.string().min(1, 'Select a category'),
  subject: z.string().trim().min(3, 'Subject is required').max(120),
  message: z.string().trim().min(10, 'Message is too short').max(2000),
});

export function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid input';
}

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export function isValidPassword(value: string): boolean {
  return passwordSchema.safeParse(value).success;
}

export function isValidUsername(value: string): boolean {
  return usernameSchema.safeParse(value).success;
}

export const passwordHint = 'At least 8 characters';
