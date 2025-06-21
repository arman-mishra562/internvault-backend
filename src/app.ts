// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.route';
import applicationRoutes from './routes/application.route';
import pricingRoutes from './routes/pricing.route';

dotenv.config();
const app = express();

app.use(cors());
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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
