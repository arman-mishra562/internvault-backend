import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import stripe from '../config/stripe';
import { Prisma } from '@prisma/client';
import { RequestHandler } from 'express';
import { getPaypalAccessToken, PAYPAL_API_BASE } from '../config/paypal';
import axios from 'axios';

export const payWithStripe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

        // Create Stripe Checkout Session
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
            success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
        });

        // Optionally, create a Payment record with status PENDING
        await prisma.payment.create({
            data: {
                applicationId: application.id,
                amount: application.price,
                currency: application.currency,
                gateway: 'STRIPE',
                gatewayPaymentId: session.id,
                status: 'PENDING',
                metadata: {},
            },
        });

        res.json({ url: session.url });
    } catch (err) {
        next(err);
    }
};

export const stripeWebhook: RequestHandler = async (req, res, next): Promise<void> => {
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
            process.env.STRIPE_WEBHOOK_SECRET as string
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
                await tx.payment.updateMany({
                    where: { gateway: 'STRIPE', gatewayPaymentId: paymentId },
                    data: { status: 'COMPLETED', metadata: session },
                });
                await tx.application.updateMany({
                    where: { id: applicationId },
                    data: { isPaid: true, status: 'IN_PROGRESS' },
                });
            });
        } catch (err) {
            res.status(500).send('Webhook DB error');
            return;
        }
    }

    res.json({ received: true });
};

export const payWithPaypal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
            }
        );

        const order = orderRes.data;
        const approvalUrl = order.links.find((l: any) => l.rel === 'approve')?.href;

        // Optionally, create a Payment record with status PENDING
        await prisma.payment.create({
            data: {
                applicationId: application.id,
                amount: application.price,
                currency: application.currency,
                gateway: 'PAYPAL',
                gatewayPaymentId: order.id,
                status: 'PENDING',
                metadata: {},
            },
        });

        res.json({ url: approvalUrl });
    } catch (err) {
        next(err);
    }
};

export const paypalWebhook: RequestHandler = async (req, res, next): Promise<void> => {
    const event = req.body;
    // PayPal webhook event types: https://developer.paypal.com/docs/api-basics/notifications/webhooks/event-names/
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = event.resource.id;
        const customId = event.resource.purchase_units?.[0]?.custom_id;
        try {
            await prisma.$transaction(async (tx) => {
                await tx.payment.updateMany({
                    where: { gateway: 'PAYPAL', gatewayPaymentId: orderId },
                    data: { status: 'COMPLETED', metadata: event },
                });
                await tx.application.updateMany({
                    where: { id: customId },
                    data: { isPaid: true, status: 'IN_PROGRESS' },
                });
            });
        } catch (err) {
            res.status(500).send('Webhook DB error');
            return;
        }
    }
    res.json({ received: true });
}; 