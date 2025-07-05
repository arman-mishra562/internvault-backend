// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.route';
import applicationRoutes from './routes/application.route';
import pricingRoutes from './routes/pricing.route';
import {
	stripeWebhook,
	paypalWebhook,
} from './controllers/payment.controller';

dotenv.config();
const app = express();

// CORS configuration - THIS IS THE FIX
const corsOptions = {
	origin: [
		'http://localhost:3000',
		'http://localhost:3001',
		'https://www.internvault.com', // Your production frontend
		'https://internvault.com', // Also allow without www
	],
	credentials: true, // This is the key fix - allows cookies/credentials
	optionsSuccessStatus: 200, // Some legacy browsers choke on 204
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-client-id', 'x-client-secret'],
};

app.use(cors(corsOptions));

// Stripe webhook (must be before express.json middleware if in same file)
app.post(
	'/webhook/stripe',
	express.raw({ type: 'application/json' }),
	stripeWebhook,
);

// PayPal webhook
app.post('/webhook/paypal', express.json(), paypalWebhook);

app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
	res.json({ status: 'OK' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/pricing', pricingRoutes);

// ——— 404 Handler ———
app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

// ——— Global Error Handler———
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
	console.error(err);
	res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
if (!process.env.PORT) {
	throw new Error("❌ PORT environment variable not set");
};
const PORT = process.env.PORT;
app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
