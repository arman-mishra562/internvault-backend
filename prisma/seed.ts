import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Default pricing plans (USD)
    const defaultPlans = [
        { duration: 1, price: 90, currency: 'USD' },
        { duration: 2, price: 170, currency: 'USD' },
        { duration: 3, price: 240, currency: 'USD' },
        { duration: 4, price: 300, currency: 'USD' },
        { duration: 5, price: 350, currency: 'USD' },
        { duration: 6, price: 390, currency: 'USD' },
    ];

    // India pricing plans (INR)
    const indiaPlans = [
        { duration: 1, price: 3500, currency: 'INR', country: 'IN' },
        { duration: 2, price: 6500, currency: 'INR', country: 'IN' },
        { duration: 3, price: 8500, currency: 'INR', country: 'IN' },
        { duration: 4, price: 10500, currency: 'INR', country: 'IN' },
        { duration: 5, price: 12500, currency: 'INR', country: 'IN' },
        { duration: 6, price: 14500, currency: 'INR', country: 'IN' },
    ];

    // UK pricing plans (GBP)
    const ukPlans = [
        { duration: 1, price: 80, currency: 'GBP', country: 'GB' },
        { duration: 2, price: 150, currency: 'GBP', country: 'GB' },
        { duration: 3, price: 210, currency: 'GBP', country: 'GB' },
        { duration: 4, price: 260, currency: 'GBP', country: 'GB' },
        { duration: 5, price: 300, currency: 'GBP', country: 'GB' },
        { duration: 6, price: 330, currency: 'GBP', country: 'GB' },
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