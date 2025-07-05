import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import stripe from '../config/stripe';
import { RequestHandler } from 'express';
import { getPaypalAccessToken, PAYPAL_API_BASE } from '../config/paypal';
import {
	generatePaymentEmail,
	generateProjectEmail,
} from '../utils/emailTemplates';
import axios from 'axios';
import { payment_transporter, no_reply_transporter } from '../config/mailer';
import {
	initiateNetBankingPayment,
} from '../utils/paymentGateways';
import { getCashfreeConfig, CASHFREE_CONFIG } from '../config/cashfree';
import { CFPaymentGateway, CFOrderRequest, CFCustomerDetails } from 'cashfree-pg-sdk-nodejs';
import crypto from 'crypto';

export const payWithStripe = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		if (!stripe) {
			res.status(503).json({ error: 'Stripe payment is not configured' });
			return;
		}

		const userId = (req as any).user.id;
		const { id: applicationId } = req.params;

		// Fetch application and check ownership, status, and payment
		const application = await prisma.application.findUnique({
			where: { id: applicationId },
		});
		if (!application || application.userId !== userId) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}
		if (application.status !== 'PENDING') {
			res.status(400).json({ error: 'Application is not pending' });
			return;
		}
		if (application.isPaid) {
			res.status(400).json({ error: 'Application already paid' });
			return;
		}

		// Check for active pending payment (not expired)
		const now = new Date();
		const pendingPayment = await prisma.payment.findFirst({
			where: {
				applicationId: application.id,
				status: 'PENDING',
				expiresAt: { gt: now },
			},
			orderBy: { createdAt: 'desc' },
		});
		const pendingUrl = (
			pendingPayment?.metadata as { checkoutUrl?: string } | null
		)?.checkoutUrl;
		if (pendingUrl) {
			res.json({ url: pendingUrl });
			return;
		}

		// Create Stripe Checkout Session with 5 min expiry
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [
				{
					price_data: {
						currency: application.currency.toLowerCase(),
						product_data: {
							name: `Application Fee for ${application.domain}`,
							description: `Role: ${application.role}`,
						},
						unit_amount: Math.round(application.price * 100), // Stripe expects cents
					},
					quantity: 1,
				},
			],
			mode: 'payment',
			customer_email: application.contactEmail,
			metadata: {
				applicationId: application.id,
				userId: application.userId,
			},
			success_url: `${process.env.FRONTEND_URL}/payment/payment-success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.FRONTEND_URL}/payment/payment-cancel`,
			// Stripe does not support direct session expiry, so we handle expiry in backend
		});

		// Create a Payment record with status PENDING and expiresAt
		await prisma.payment.create({
			data: {
				applicationId: application.id,
				amount: application.price,
				currency: application.currency,
				gateway: 'STRIPE',
				gatewayPaymentId: session.id,
				status: 'PENDING',
				metadata: { checkoutUrl: session.url },
				expiresAt: expiresAt,
			},
		});

		res.json({ url: session.url });
	} catch (err) {
		next(err);
	}
};

export const stripeWebhook: RequestHandler = async (
	req,
	res,
	next,
): Promise<void> => {
	if (!stripe) {
		res.status(503).send('Stripe is not configured');
		return;
	}

	const sig = req.headers['stripe-signature'] as string;
	let event;
	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET as string,
		);
	} catch (err: any) {
		res.status(400).send(`Webhook Error: ${err.message}`);
		return;
	}

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as any;
		const applicationId = session.metadata?.applicationId;
		const paymentId = session.id;

		try {
			await prisma.$transaction(async (tx) => {
				// 1. Mark payment as completed
				await tx.payment.updateMany({
					where: { gateway: 'STRIPE', gatewayPaymentId: paymentId },
					data: { status: 'COMPLETED', metadata: session },
				});
				// 2. Update application status and set internship certificate
				await tx.application.updateMany({
					where: { id: applicationId },
					data: {
						isPaid: true,
						status: 'COMPLETED',
						hasInternshipCertificate: true
					},
				});
				// 3. Fetch application and user
				const application = await tx.application.findUnique({
					where: { id: applicationId },
				});
				if (!application) throw new Error('Application not found');
				const user = await tx.user.findUnique({
					where: { id: application.userId },
				});
				if (!user) throw new Error('User not found');

				// 4. Send email to user
				await payment_transporter.sendMail({
					from: `"InternVault" <${process.env.SMTP_PAYMENT_USER}>`,
					to: application.contactEmail,
					subject: 'Payment Successful - Internship Certificate Unlocked!',
					html: generatePaymentEmail(
						application.role,
						application.fullName,
						application.duration.toString(),
						application.updatedAt.toISOString(),
						new Date().toISOString(),
					),
				});
			});
		} catch (err) {
			res.status(500).send('Webhook DB error');
			return;
		}
	}

	res.json({ received: true });
};

export const payWithPaypal = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		const { id: applicationId } = req.params;

		// Fetch application and check ownership, status, and payment
		const application = await prisma.application.findUnique({
			where: { id: applicationId },
		});
		if (!application || application.userId !== userId) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}
		if (application.status !== 'PENDING') {
			res.status(400).json({ error: 'Application is not pending' });
			return;
		}
		if (application.isPaid) {
			res.status(400).json({ error: 'Application already paid' });
			return;
		}

		// Check for active pending payment (not expired)
		const now = new Date();
		const pendingPayment = await prisma.payment.findFirst({
			where: {
				applicationId: application.id,
				status: 'PENDING',
				expiresAt: { gt: now },
			},
			orderBy: { createdAt: 'desc' },
		});
		const pendingUrl = (
			pendingPayment?.metadata as { approvalUrl?: string } | null
		)?.approvalUrl;
		if (pendingUrl) {
			res.json({ url: pendingUrl });
			return;
		}

		// Get PayPal access token
		const accessToken = await getPaypalAccessToken();

		// Create PayPal order
		const orderRes = await axios.post(
			`${PAYPAL_API_BASE}/v2/checkout/orders`,
			{
				intent: 'CAPTURE',
				purchase_units: [
					{
						amount: {
							currency_code: application.currency,
							value: application.price.toFixed(2),
						},
						description: `Application Fee for ${application.domain} (Role: ${application.role})`,
						custom_id: application.id,
					},
				],
				application_context: {
					brand_name: 'InternVault',
					user_action: 'PAY_NOW',
					return_url: `${process.env.FRONTEND_URL}/payment-success/paypal`,
					cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
				},
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
			},
		);

		const order = orderRes.data;
		const approvalUrl = order.links.find((l: any) => l.rel === 'approve')?.href;

		// Create a Payment record with status PENDING and expiresAt
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
		await prisma.payment.create({
			data: {
				applicationId: application.id,
				amount: application.price,
				currency: application.currency,
				gateway: 'PAYPAL',
				gatewayPaymentId: order.id,
				status: 'PENDING',
				metadata: { approvalUrl },
				expiresAt,
			},
		});

		res.json({ url: approvalUrl });
	} catch (err) {
		next(err);
	}
};

export const paypalWebhook: RequestHandler = async (
	req,
	res,
	next,
): Promise<void> => {
	const event = req.body;
	// PayPal webhook event types: https://developer.paypal.com/docs/api-basics/notifications/webhooks/event-names/
	if (
		event.event_type === 'CHECKOUT.ORDER.APPROVED' ||
		event.event_type === 'PAYMENT.CAPTURE.COMPLETED'
	) {
		const orderId = event.resource.id;
		const customId = event.resource.purchase_units?.[0]?.custom_id;
		try {
			await prisma.$transaction(async (tx) => {
				// 1. Mark payment as completed
				await tx.payment.updateMany({
					where: { gateway: 'PAYPAL', gatewayPaymentId: orderId },
					data: { status: 'COMPLETED', metadata: event },
				});
				// 2. Update application status
				await tx.application.updateMany({
					where: { id: customId },
					data: { isPaid: true, status: 'IN_PROGRESS' },
				});
				// 3. Fetch application and user
				const application = await tx.application.findUnique({
					where: { id: customId },
				});
				if (!application) throw new Error('Application not found');
				const user = await tx.user.findUnique({
					where: { id: application.userId },
				});
				if (!user) throw new Error('User not found');
				// 4. Find purchased plan
				const plan = await tx.pricingPlan.findFirst({
					where: {
						price: application.price,
						currency: application.currency,
					},
				});
				// 5. Send email to user
				const certificateUnlockDate = new Date(
					application.updatedAt.getTime() + (plan?.duration ?? 0) * 30 * 24 * 60 * 60 * 1000 - 5 * 24 * 60 * 60 * 1000,
				);
				await payment_transporter.sendMail({
					from: `"InternVault" <${process.env.SMTP_PAYMENT_USER}>`,
					to: application.contactEmail,
					subject: 'Payment Successful',
					html: generatePaymentEmail(
						application.role,
						application.fullName,
						plan?.duration?.toString() ?? '',
						application.updatedAt.toISOString(),
						certificateUnlockDate.toISOString(),
					),
				});
			});
		} catch (err) {
			res.status(500).send('Webhook DB error');
			return;
		}
	}
	res.json({ received: true });
};

export const payWithNetBanking = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		const { id: applicationId } = req.params;

		// Fetch application and check ownership, status, and payment
		const application = await prisma.application.findUnique({
			where: { id: applicationId },
		});
		if (!application || application.userId !== userId) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}
		if (application.status !== 'PENDING') {
			res.status(400).json({ error: 'Application is not pending' });
			return;
		}
		if (application.isPaid) {
			res.status(400).json({ error: 'Application already paid' });
			return;
		}

		// Check for active pending payment (not expired)
		const now = new Date();
		const pendingPayment = await prisma.payment.findFirst({
			where: {
				applicationId: application.id,
				status: 'PENDING',
				expiresAt: { gt: now },
				gateway: 'NETBANKING',
			},
			orderBy: { createdAt: 'desc' },
		});
		const pendingUrl = (
			pendingPayment?.metadata as { paymentUrl?: string } | null
		)?.paymentUrl;
		if (pendingUrl) {
			res.json({ url: pendingUrl });
			return;
		}

		// Initiate Net Banking payment (simulate)
		const { url, gatewayPaymentId } = await initiateNetBankingPayment(
			application,
		);
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
		await prisma.payment.create({
			data: {
				applicationId: application.id,
				amount: application.price,
				currency: application.currency,
				gateway: 'NETBANKING',
				gatewayPaymentId,
				status: 'PENDING',
				metadata: { paymentUrl: url },
				expiresAt,
			},
		});
		res.json({ url });
	} catch (err) {
		next(err);
	}
};

export const payWithCashfreeUPI = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		const { id: applicationId } = req.params;

		// Fetch application and check ownership, status, and payment
		const application = await prisma.application.findUnique({
			where: { id: applicationId },
		});
		if (!application || application.userId !== userId) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}
		if (application.status !== 'PENDING') {
			res.status(400).json({ error: 'Application is not pending' });
			return;
		}
		if (application.isPaid) {
			res.status(400).json({ error: 'Application already paid' });
			return;
		}

		// Check for active pending payment (not expired)
		const now = new Date();
		const pendingPayment = await prisma.payment.findFirst({
			where: {
				applicationId: application.id,
				status: 'PENDING',
				expiresAt: { gt: now },
				gateway: 'CASHFREE',
			},
			orderBy: { createdAt: 'desc' },
		});
		const pendingUrl = (
			pendingPayment?.metadata as { paymentUrl?: string } | null
		)?.paymentUrl;
		if (pendingUrl) {
			res.json({ url: pendingUrl });
			return;
		}

		// Create Cashfree order
		const cfConfig = getCashfreeConfig();
		const apiInstance = new CFPaymentGateway();
		const orderRequest = new CFOrderRequest();
		orderRequest.orderAmount = application.price;
		orderRequest.orderCurrency = application.currency;
		const customerDetails = new CFCustomerDetails();
		customerDetails.customerId = application.userId;
		customerDetails.customerEmail = application.contactEmail;
		customerDetails.customerPhone = application.whatsappNumber.replace(/\D/g, '').slice(-10);
		orderRequest.customerDetails = customerDetails;
		orderRequest.orderNote = `InternVault Application Fee for ${application.domain} (${application.role})`;
		orderRequest.orderMeta = {
			returnUrl: CASHFREE_CONFIG.RETURN_URL,
			notifyUrl: CASHFREE_CONFIG.CALLBACK_URL,
			paymentMethods: 'upi',
		};
		const orderResponse = await apiInstance.orderCreate(cfConfig, orderRequest);
		const paymentLink = orderResponse?.cfOrder?.paymentSessionId || '';
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
		await prisma.payment.create({
			data: {
				applicationId: application.id,
				amount: application.price,
				currency: application.currency,
				gateway: 'CASHFREE',
				gatewayPaymentId: orderResponse?.cfOrder?.orderId,
				status: 'PENDING',
				metadata: { paymentUrl: paymentLink },
				expiresAt,
			},
		});
		res.json({ url: paymentLink });
	} catch (err) {
		next(err);
	}
};

export const cashfreeWebhook: RequestHandler = async (req, res, next) => {
	try {
		// Verify webhook signature
		const signature = req.headers['x-webhook-signature'] as string;
		const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;

		if (webhookSecret && signature) {
			const payload = JSON.stringify(req.body);
			const expectedSignature = crypto
				.createHmac('sha256', webhookSecret)
				.update(payload)
				.digest('hex');

			if (signature !== expectedSignature) {
				console.error('Invalid webhook signature');
				res.status(401).json({ error: 'Invalid signature' });
				return;
			}
		} else if (webhookSecret) {
			console.warn('Webhook secret configured but no signature received');
		}

		const event = req.body;
		console.log('Cashfree webhook received:', {
			eventType: event.eventType,
			orderId: event.order?.orderId,
			orderStatus: event.order?.orderStatus,
			timestamp: new Date().toISOString()
		});

		// Handle v3 webhook payload structure
		const orderId = event.order?.orderId || event.order?.order_id;
		const eventType = event.eventType || event.event_type;

		if (!orderId) {
			console.error('Missing orderId in webhook payload');
			res.status(400).json({ error: 'Missing orderId' });
			return;
		}

		// Find the payment and application
		const payment = await prisma.payment.findFirst({
			where: { gateway: 'CASHFREE', gatewayPaymentId: orderId },
		});

		if (!payment) {
			console.error(`Payment not found for orderId: ${orderId}`);
			res.status(404).json({ error: 'Payment not found' });
			return;
		}

		const applicationId = payment.applicationId;
		console.log(`Processing ${eventType} for application: ${applicationId}`);

		// Handle different event types
		switch (eventType) {
			case 'order.paid':
			case 'order.success':
				await handleSuccessfulPayment(payment, event, orderId, applicationId);
				break;

			case 'order.failed':
			case 'order.failure':
				await handleFailedPayment(payment, event, orderId, applicationId);
				break;

			case 'order.expired':
			case 'order.abandoned':
				await handleAbandonedPayment(payment, event, orderId, applicationId);
				break;

			case 'order.dropped':
			case 'order.cancelled':
				await handleDroppedPayment(payment, event, orderId, applicationId);
				break;

			default:
				console.log(`Unhandled event type: ${eventType}`);
				res.json({ received: true, message: 'Event type not handled' });
				return;
		}

		res.json({ received: true, message: `${eventType} processed successfully` });
	} catch (err) {
		console.error('Webhook processing error:', err);
		next(err);
	}
};

// Handle successful payment
async function handleSuccessfulPayment(payment: any, event: any, orderId: string, applicationId: string) {
	// Check if payment is already completed
	if (payment.status === 'COMPLETED') {
		console.log(`Payment already processed for orderId: ${orderId}`);
		return;
	}

	await prisma.$transaction(async (tx) => {
		// 1. Mark payment as completed
		await tx.payment.updateMany({
			where: { gateway: 'CASHFREE', gatewayPaymentId: orderId },
			data: {
				status: 'COMPLETED',
				metadata: {
					...(typeof payment.metadata === 'object' && payment.metadata !== null ? payment.metadata : {}),
					cashfreeResponse: event,
					status: 'PAID',
					eventType: 'order.paid',
					processedAt: new Date().toISOString()
				},
			},
		});

		// 2. Update application status
		await tx.application.updateMany({
			where: { id: applicationId },
			data: { isPaid: true, status: 'IN_PROGRESS' },
		});

		// 3. Fetch application and user
		const application = await tx.application.findUnique({ where: { id: applicationId } });
		if (!application) throw new Error('Application not found');
		const user = await tx.user.findUnique({ where: { id: application.userId } });
		if (!user) throw new Error('User not found');

		// 4. Find purchased plan
		const plan = await tx.pricingPlan.findFirst({
			where: { price: application.price, currency: application.currency },
		});

		// 5. Send email to user
		const certificateUnlockDate = new Date(
			application.updatedAt.getTime() + (plan?.duration ?? 0) * 30 * 24 * 60 * 60 * 1000 - 5 * 24 * 60 * 60 * 1000,
		);
		await payment_transporter.sendMail({
			from: `"InternVault" <${process.env.SMTP_PAYMENT_USER}>`,
			to: application.contactEmail,
			subject: 'Payment Successful',
			html: generatePaymentEmail(
				application.role,
				application.fullName,
				plan?.duration?.toString() ?? '',
				application.updatedAt.toISOString(),
				certificateUnlockDate.toISOString(),
			),
		});

		console.log(`Payment processed successfully for application: ${applicationId}`);
	});
}

// Handle failed payment
async function handleFailedPayment(payment: any, event: any, orderId: string, applicationId: string) {
	await prisma.$transaction(async (tx) => {
		// 1. Mark payment as failed
		await tx.payment.updateMany({
			where: { gateway: 'CASHFREE', gatewayPaymentId: orderId },
			data: {
				status: 'FAILED',
				metadata: {
					...(typeof payment.metadata === 'object' && payment.metadata !== null ? payment.metadata : {}),
					cashfreeResponse: event,
					status: 'FAILED',
					eventType: 'order.failed',
					failureReason: event.order?.failureReason || event.order?.failure_reason,
					processedAt: new Date().toISOString()
				},
			},
		});

		// 2. Fetch application for email
		const application = await tx.application.findUnique({ where: { id: applicationId } });
		if (application) {
			// 3. Send failure email to user
			await payment_transporter.sendMail({
				from: `"InternVault" <${process.env.SMTP_PAYMENT_USER}>`,
				to: application.contactEmail,
				subject: 'Payment Failed',
				html: `
					<h2>Payment Failed</h2>
					<p>Dear ${application.fullName},</p>
					<p>Your payment for the ${application.domain} internship application has failed.</p>
					<p>You can try again by visiting your application dashboard.</p>
					<p>If you continue to face issues, please contact our support team.</p>
					<br>
					<p>Best regards,<br>InternVault Team</p>
				`,
			});
		}

		console.log(`Payment failed for application: ${applicationId}`);
	});
}

// Handle abandoned/expired payment
async function handleAbandonedPayment(payment: any, event: any, orderId: string, applicationId: string) {
	await prisma.$transaction(async (tx) => {
		// 1. Mark payment as cancelled (expired)
		await tx.payment.updateMany({
			where: { gateway: 'CASHFREE', gatewayPaymentId: orderId },
			data: {
				status: 'CANCELLED',
				metadata: {
					...(typeof payment.metadata === 'object' && payment.metadata !== null ? payment.metadata : {}),
					cashfreeResponse: event,
					status: 'EXPIRED',
					eventType: 'order.expired',
					processedAt: new Date().toISOString()
				},
			},
		});

		console.log(`Payment expired for application: ${applicationId}`);
	});
}

// Handle dropped/cancelled payment
async function handleDroppedPayment(payment: any, event: any, orderId: string, applicationId: string) {
	await prisma.$transaction(async (tx) => {
		// 1. Mark payment as cancelled
		await tx.payment.updateMany({
			where: { gateway: 'CASHFREE', gatewayPaymentId: orderId },
			data: {
				status: 'CANCELLED',
				metadata: {
					...(typeof payment.metadata === 'object' && payment.metadata !== null ? payment.metadata : {}),
					cashfreeResponse: event,
					status: 'CANCELLED',
					eventType: 'order.dropped',
					processedAt: new Date().toISOString()
				},
			},
		});

		console.log(`Payment cancelled for application: ${applicationId}`);
	});
}
