import { Router } from "express";
import {
    submitApplication,
    getUserApplications,
    getApplication,
    getAllApplications,
    updateApplicationStatus,
    getUserDashboardProjects
} from '../controllers/application.controller';
import validateRequest from '../middlewares/validateRequest';
import { isAuthenticated, isAdmin } from "../middlewares/auth.middleware";
import { applicationSchema, updateApplicationSchema } from '../schemas/application.schema';
import { payWithStripe, payWithPaypal } from '../controllers/payment.controller';

const router = Router();

// User routes (require authentication)
router.post(
    '/submit',
    isAuthenticated,
    validateRequest({ body: applicationSchema }),
    submitApplication
);

router.get(
    '/my-applications',
    isAuthenticated,
    getUserApplications
);

router.get(
    '/my-applications/:id',
    isAuthenticated,
    getApplication
);

// Admin routes (require admin authentication)
router.get(
    '/all',
    isAuthenticated,
    isAdmin,
    getAllApplications
);

router.patch(
    '/:id/status',
    isAuthenticated,
    isAdmin,
    validateRequest({ body: updateApplicationSchema }),
    updateApplicationStatus
);

// Payment route (Stripe)
router.post(
    '/:id/pay/stripe',
    isAuthenticated,
    payWithStripe
);

// Payment route (PayPal)
router.post(
    '/:id/pay/paypal',
    isAuthenticated,
    payWithPaypal
);

router.get(
    '/dashboard-projects',
    isAuthenticated,
    getUserDashboardProjects
);

export default router; 