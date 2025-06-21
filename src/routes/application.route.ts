import { Router } from "express";
import {
    submitApplication,
    getUserApplications,
    getApplication,
    getAllApplications,
    updateApplicationStatus
} from '../controllers/application.controller';
import validateRequest from '../middlewares/validateRequest';
import { isAuthenticated, isAdmin } from "../middlewares/auth.middleware";
import { applicationSchema, updateApplicationSchema } from '../schemas/application.schema';

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

export default router; 