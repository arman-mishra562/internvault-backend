import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().nonempty('Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
