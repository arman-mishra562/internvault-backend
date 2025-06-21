import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const verifySchema = z.object({
  token: z.string().nonempty('Token is required'),
});

export const resendSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const linkProfilePicSchema = z.object({
  key: z.string().min(1, 'Media key is required'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required'),
});