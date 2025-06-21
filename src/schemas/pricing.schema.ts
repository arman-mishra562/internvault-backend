import { z } from 'zod';

export const pricingPlanSchema = z.object({
    duration: z.number().int().min(1).max(12, 'Duration must be between 1 and 12 months'),
    price: z.number().positive('Price must be positive'),
    currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD)'),
    country: z.string().optional(),
    isActive: z.boolean().optional().default(true),
});

export const updatePricingPlanSchema = z.object({
    price: z.number().positive('Price must be positive').optional(),
    currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD)').optional(),
    isActive: z.boolean().optional(),
});

export type PricingPlanInput = z.infer<typeof pricingPlanSchema>;
export type UpdatePricingPlanInput = z.infer<typeof updatePricingPlanSchema>; 