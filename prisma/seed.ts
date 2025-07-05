import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
	console.log('🌱 Seeding database...');

	// ----- Pricing Plans Seeding -----
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

	// Nepal pricing plans (NPR)
	const nepalPlans = [
		{ duration: 1, price: 6000, currency: 'NPR', country: 'NP' },
		{ duration: 2, price: 12000, currency: 'NPR', country: 'NP' },
		{ duration: 3, price: 16000, currency: 'NPR', country: 'NP' },
		{ duration: 4, price: 19000, currency: 'NPR', country: 'NP' },
		{ duration: 5, price: 23000, currency: 'NPR', country: 'NP' },
		{ duration: 6, price: 27000, currency: 'NPR', country: 'NP' },
	];

	// Pakistan pricing plans (PKR)
	const pakistanPlans = [
		{ duration: 1, price: 13000, currency: 'PKR', country: 'PK' },
		{ duration: 2, price: 25000, currency: 'PKR', country: 'PK' },
		{ duration: 3, price: 33000, currency: 'PKR', country: 'PK' },
		{ duration: 4, price: 40000, currency: 'PKR', country: 'PK' },
		{ duration: 5, price: 48000, currency: 'PKR', country: 'PK' },
		{ duration: 6, price: 56000, currency: 'PKR', country: 'PK' },
	];

	// Indonesia pricing plans (IDR)
	const indonesiaPlans = [
		{ duration: 1, price: 780000, currency: 'IDR', country: 'ID' },
		{ duration: 2, price: 1400000, currency: 'IDR', country: 'ID' },
		{ duration: 3, price: 1800000, currency: 'IDR', country: 'ID' },
		{ duration: 4, price: 2300000, currency: 'IDR', country: 'ID' },
		{ duration: 5, price: 2700000, currency: 'IDR', country: 'ID' },
		{ duration: 6, price: 3100000, currency: 'IDR', country: 'ID' },
	];

	// Check existing pricing plans and only add missing ones
	const allPlans = [...defaultPlans, ...indiaPlans, ...ukPlans, ...euPlans, ...nepalPlans, ...pakistanPlans, ...indonesiaPlans];
	let pricingPlansCreated = 0;

	for (const plan of allPlans) {
		const existingPlan = await prisma.pricingPlan.findFirst({
			where: {
				duration: plan.duration,
				currency: plan.currency,
				country: (plan as any).country || null,
			},
		});

		if (!existingPlan) {
			await prisma.pricingPlan.create({ data: plan });
			pricingPlansCreated++;
		}
	}

	console.log(`📊 Created ${pricingPlansCreated} new pricing plans (${allPlans.length - pricingPlansCreated} already existed)`);

	// ----- Projects Seeding from Excel -----
	console.log('📁 Seeding projects from Excel...');
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(path.join(__dirname, 'ProjectsInternVault.xlsx'));

	const worksheet = workbook.getWorksheet(1); // Get first worksheet
	if (!worksheet) {
		throw new Error('No worksheet found in the Excel file');
	}

	const rows: Record<string, any>[] = [];

	// Get headers from first row
	const headers: string[] = [];
	worksheet.getRow(1).eachCell((cell, colNumber) => {
		headers[colNumber - 1] = cell.value?.toString() || '';
	});

	// Process data rows
	worksheet.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return; // Skip header row

		const rowData: Record<string, any> = {};
		row.eachCell((cell, colNumber) => {
			const header = headers[colNumber - 1];
			if (header) {
				rowData[header] = cell.value?.toString() || '';
			}
		});
		rows.push(rowData);
	});

	let projectsCreated = 0;
	let projectsSkipped = 0;

	for (const row of rows) {
		const { title, domain, role, difficulty, url } = row;

		if (!role || !domain || !difficulty || !url) {
			console.warn(
				`Skipping row with missing required fields: ${JSON.stringify(row)}`,
			);
			projectsSkipped++;
			continue;
		}

		// Check if project already exists
		const existingProject = await prisma.project.findFirst({
			where: {
				domain,
				role,
				difficulty: difficulty as any,
				url,
			},
		});

		if (!existingProject) {
			await prisma.project.create({
				data: {
					title,
					domain,
					role,
					difficulty: difficulty as any,
					url,
				},
			});
			projectsCreated++;
		} else {
			projectsSkipped++;
		}
	}

	console.log(`✅ Seeded ${projectsCreated} new projects successfully. ${projectsSkipped} projects already existed or were skipped.`);
}

main()
	.catch((e) => {
		console.error('❌ Error seeding database:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
