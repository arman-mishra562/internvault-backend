import { Router } from "express";
import {
    getPricingPlans,
    createPricingPlan,
    getAllPricingPlans,
    updatePricingPlan,
    deletePricingPlan,
    testPricingPlans
} from '../controllers/pricing.controller';
import validateRequest from '../middlewares/validateRequest';
import { isAuthenticated, isAdmin } from "../middlewares/auth.middleware";
import { pricingPlanSchema, updatePricingPlanSchema } from '../schemas/pricing.schema';

const router = Router();

// Public route for carousel (no authentication required)
router.get('/carousel', getPricingPlans);

// Admin routes (require admin authentication)
router.post(
    '/',
    isAuthenticated,
    isAdmin,
    validateRequest({ body: pricingPlanSchema }),
    createPricingPlan
);

router.get(
    '/all',
    isAuthenticated,
    isAdmin,
    getAllPricingPlans
);

router.patch(
    '/:id',
    isAuthenticated,
    isAdmin,
    validateRequest({ body: updatePricingPlanSchema }),
    updatePricingPlan
);

router.delete(
    '/:id',
    isAuthenticated,
    isAdmin,
    deletePricingPlan
);

// Test route for debugging pricing plans
router.get('/test', testPricingPlans);

export default router; 