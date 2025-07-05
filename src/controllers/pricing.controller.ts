import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../config/prisma';
import { pricingPlanSchema, updatePricingPlanSchema } from '../schemas/pricing.schema';
import { getCountryFromIP, getClientIP } from '../utils/geolocation';

// Get pricing plans for carousel (based on user's country)
export const getPricingPlans: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Allow manual country override for testing
        const manualCountry = req.query.country as string;

        let country: string;
        let currency: string;

        if (manualCountry) {
            // Use manually specified country
            country = manualCountry;
            currency = getCurrencyForCountry(manualCountry);
        } else {
            // Use geolocation
            const clientIP = getClientIP(req);
            const geoResult = await getCountryFromIP(clientIP);
            country = geoResult.country;
            currency = geoResult.currency;
        }

        // Get pricing plans for the user's country, fallback to default (null country)
        const pricingPlans = await prisma.pricingPlan.findMany({
            where: {
                isActive: true,
                OR: [
                    { country: country },
                    { country: null } // Default plans
                ]
            },
            orderBy: { duration: 'asc' },
            select: {
                id: true,
                duration: true,
                price: true,
                currency: true,
                country: true
            }
        });

        // If no country-specific plans found, use default plans
        const countrySpecificPlans = pricingPlans.filter(plan => plan.country === country);
        const defaultPlans = pricingPlans.filter(plan => plan.country === null);

        const finalPlans = countrySpecificPlans.length > 0 ? countrySpecificPlans : defaultPlans;

        res.json({
            pricingPlans: finalPlans,
            userCountry: country,
            userCurrency: currency
        });
    } catch (err) {
        next(err);
    }
};

// Helper function to get currency for a country
function getCurrencyForCountry(country: string): string {
    const currencyMap: { [key: string]: string } = {
        'IN': 'INR',
        'US': 'USD',
        'GB': 'GBP',
        'EU': 'EUR',
        'CA': 'CAD',
        'AU': 'AUD'
    };
    return currencyMap[country] || 'USD';
}

// Admin: Create pricing plan
export const createPricingPlan: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const parse = pricingPlanSchema.safeParse(req.body);
        if (!parse.success) {
            res.status(400).json({ errors: parse.error.flatten().fieldErrors });
            return;
        }

        const { duration, price, currency, country, isActive } = parse.data;

        const pricingPlan = await prisma.pricingPlan.create({
            data: {
                duration,
                price,
                currency,
                country,
                isActive
            }
        });

        res.status(201).json({
            message: 'Pricing plan created successfully',
            pricingPlan
        });
    } catch (err) {
        next(err);
    }
};

// Admin: Get all pricing plans
export const getAllPricingPlans: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { country, isActive } = req.query;
        const where: any = {};

        if (country) {
            where.country = country;
        }
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        const pricingPlans = await prisma.pricingPlan.findMany({
            where,
            orderBy: [
                { country: 'asc' },
                { duration: 'asc' }
            ]
        });

        res.json({ pricingPlans });
    } catch (err) {
        next(err);
    }
};

// Admin: Update pricing plan
export const updatePricingPlan: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const parse = updatePricingPlanSchema.safeParse(req.body);

        if (!parse.success) {
            res.status(400).json({ errors: parse.error.flatten().fieldErrors });
            return;
        }

        const pricingPlan = await prisma.pricingPlan.findUnique({
            where: { id }
        });

        if (!pricingPlan) {
            res.status(404).json({ error: 'Pricing plan not found' });
            return;
        }

        const updatedPricingPlan = await prisma.pricingPlan.update({
            where: { id },
            data: parse.data
        });

        res.json({
            message: 'Pricing plan updated successfully',
            pricingPlan: updatedPricingPlan
        });
    } catch (err) {
        next(err);
    }
};

// Admin: Delete pricing plan
export const deletePricingPlan: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const pricingPlan = await prisma.pricingPlan.findUnique({
            where: { id }
        });

        if (!pricingPlan) {
            res.status(404).json({ error: 'Pricing plan not found' });
            return;
        }

        await prisma.pricingPlan.delete({
            where: { id }
        });

        res.json({ message: 'Pricing plan deleted successfully' });
    } catch (err) {
        next(err);
    }
}; 