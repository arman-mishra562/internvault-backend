import { z } from 'zod';

export const applicationSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be less than 100 characters'),
    contactEmail: z.string().email('Invalid email format'),
    whatsappNumber: z.string().min(10, 'WhatsApp number must be at least 10 digits').max(15, 'WhatsApp number must be less than 15 digits'),
    role: z.string().min(2, 'Role must be at least 2 characters').max(100, 'Role must be less than 100 characters'),
    domain: z.string().min(3, 'Domain must be at least 3 characters').max(100, 'Domain must be less than 100 characters'),
    duration: z.number().int().min(1, 'Duration must be at least 1 month').max(6, 'Duration must be at most 6 months'),
    price: z.number().positive('Price must be positive'),
    currency: z.string().min(3, 'Currency must be at least 3 characters').max(3, 'Currency must be 3 characters (e.g., USD)'),
});

export const updateApplicationSchema = z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
});

export const projectSubmissionSchema = z.object({
    submissionUrl: z.string().url('Must be a valid URL'),
});

export const projectApprovalSchema = z.object({
    approved: z.boolean(),
    points: z.number().int().min(0, 'Points must be non-negative').optional(),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type ProjectSubmissionInput = z.infer<typeof projectSubmissionSchema>;
export type ProjectApprovalInput = z.infer<typeof projectApprovalSchema>; 