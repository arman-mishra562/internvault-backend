import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Default pricing plans (USD)
    const defaultPlans = [
        { duration: 1, price: 99, currency: 'USD' },
        { duration: 2, price: 189, currency: 'USD' },
        { duration: 3, price: 269, currency: 'USD' },
        { duration: 4, price: 349, currency: 'USD' },
        { duration: 5, price: 429, currency: 'USD' },
        { duration: 6, price: 499, currency: 'USD' },
    ];

    // India pricing plans (INR)
    const indiaPlans = [
        { duration: 1, price: 7999, currency: 'INR', country: 'IN' },
        { duration: 2, price: 14999, currency: 'INR', country: 'IN' },
        { duration: 3, price: 21999, currency: 'INR', country: 'IN' },
        { duration: 4, price: 28999, currency: 'INR', country: 'IN' },
        { duration: 5, price: 35999, currency: 'INR', country: 'IN' },
        { duration: 6, price: 41999, currency: 'INR', country: 'IN' },
    ];

    // UK pricing plans (GBP)
    const ukPlans = [
        { duration: 1, price: 79, currency: 'GBP', country: 'GB' },
        { duration: 2, price: 149, currency: 'GBP', country: 'GB' },
        { duration: 3, price: 219, currency: 'GBP', country: 'GB' },
        { duration: 4, price: 289, currency: 'GBP', country: 'GB' },
        { duration: 5, price: 359, currency: 'GBP', country: 'GB' },
        { duration: 6, price: 419, currency: 'GBP', country: 'GB' },
    ];

    // EU pricing plans (EUR)
    const euPlans = [
        { duration: 1, price: 89, currency: 'EUR', country: 'EU' },
        { duration: 2, price: 169, currency: 'EUR', country: 'EU' },
        { duration: 3, price: 249, currency: 'EUR', country: 'EU' },
        { duration: 4, price: 329, currency: 'EUR', country: 'EU' },
        { duration: 5, price: 409, currency: 'EUR', country: 'EU' },
        { duration: 6, price: 479, currency: 'EUR', country: 'EU' },
    ];

    // Clear existing pricing plans
    await prisma.pricingPlan.deleteMany();

    // Insert default plans
    for (const plan of defaultPlans) {
        await prisma.pricingPlan.create({
            data: plan
        });
    }

    // Insert country-specific plans
    for (const plan of [...indiaPlans, ...ukPlans, ...euPlans]) {
        await prisma.pricingPlan.create({
            data: plan
        });
    }

    console.log('✅ Database seeded successfully!');
    console.log(`📊 Created ${defaultPlans.length + indiaPlans.length + ukPlans.length + euPlans.length} pricing plans`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    }); 