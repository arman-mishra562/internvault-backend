import { Router } from 'express';
import {
	submitApplication,
	getUserApplications,
	getApplication,
	getAllApplications,
	updateApplicationStatus,
	getUserProjects,
	submitProject,
	approveProject,
	getApplicationWithProjects,
	deleteApplication,
} from '../controllers/application.controller';
import validateRequest from '../middlewares/validateRequest';
import { isAuthenticated, isAdmin } from '../middlewares/auth.middleware';
import {
	applicationSchema,
	updateApplicationSchema,
	projectSubmissionSchema,
	projectApprovalSchema,
} from '../schemas/application.schema';
import {
	payWithStripe,
	payWithPaypal,
	payWithNetBanking,
	payWithCashfreeUPI,
	cashfreeWebhook,
} from '../controllers/payment.controller';

const router = Router();

// User routes (require authentication)
router.post(
	'/submit',
	isAuthenticated,
	validateRequest({ body: applicationSchema }),
	submitApplication,
);

router.get('/my-applications', isAuthenticated, getUserApplications);

router.get('/my-applications/:id', isAuthenticated, getApplication);

router.get('/my-applications/:id/with-projects', isAuthenticated, getApplicationWithProjects);

// Project management routes
router.get('/:applicationId/projects', isAuthenticated, getUserProjects);

router.post(
	'/:applicationId/projects/:projectId/submit',
	isAuthenticated,
	validateRequest({ body: projectSubmissionSchema }),
	submitProject,
);

// Admin routes (require admin authentication)
router.get('/all', isAuthenticated, isAdmin, getAllApplications);

router.patch(
	'/:id/status',
	isAuthenticated,
	isAdmin,
	validateRequest({ body: updateApplicationSchema }),
	updateApplicationStatus,
);

router.patch(
	'/:applicationId/projects/:projectId/approve',
	isAuthenticated,
	isAdmin,
	validateRequest({ body: projectApprovalSchema }),
	approveProject,
);

// Payment routes
router.post('/:id/pay/stripe', isAuthenticated, payWithStripe);

router.post('/:id/pay/paypal', isAuthenticated, payWithPaypal);

router.post('/:id/pay/netbanking', isAuthenticated, payWithNetBanking);

router.post('/:id/pay/cashfree-upi', isAuthenticated, payWithCashfreeUPI);

// Webhook routes
router.post('/webhook/cashfree', cashfreeWebhook);

router.delete('/:id', isAuthenticated, deleteApplication);

export default router;
