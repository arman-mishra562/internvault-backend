import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../config/prisma';
import {
	applicationSchema,
	updateApplicationSchema,
} from '../schemas/application.schema';

// Submit application form
export const submitApplication: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = applicationSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const userId = (req as any).user.id;
		const {
			fullName,
			contactEmail,
			whatsappNumber,
			role,
			domain,
			price,
			currency,
		} = parse.data;

		// Check if user already has a pending application
		const existingApplication = await prisma.application.findFirst({
			where: {
				userId,
				status: 'PENDING',
			},
		});

		if (existingApplication) {
			res.status(409).json({
				error: 'You already have a pending application',
				application: {
					id: existingApplication.id,
					fullName: existingApplication.fullName,
					contactEmail: existingApplication.contactEmail,
					whatsappNumber: existingApplication.whatsappNumber,
					role: existingApplication.role,
					domain: existingApplication.domain,
					price: existingApplication.price,
					currency: existingApplication.currency,
					status: existingApplication.status,
					createdAt: existingApplication.createdAt,
				},
			});
			return;
		}

		const application = await prisma.application.create({
			data: {
				fullName,
				contactEmail,
				whatsappNumber,
				role,
				domain,
				price,
				currency,
				userId,
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		res.status(201).json({
			message: 'Application submitted successfully',
			application: {
				id: application.id,
				fullName: application.fullName,
				contactEmail: application.contactEmail,
				whatsappNumber: application.whatsappNumber,
				role: application.role,
				domain: application.domain,
				price: application.price,
				currency: application.currency,
				status: application.status,
				createdAt: application.createdAt,
			},
		});
	} catch (err) {
		next(err);
	}
};

// Get user's applications
export const getUserApplications: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;

		const applications = await prisma.application.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				fullName: true,
				contactEmail: true,
				whatsappNumber: true,
				role: true,
				domain: true,
				price: true,
				currency: true,
				status: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		res.json({ applications });
	} catch (err) {
		next(err);
	}
};

// Get specific application
export const getApplication: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		const { id } = req.params;

		const application = await prisma.application.findFirst({
			where: {
				id,
				userId,
			},
			select: {
				id: true,
				fullName: true,
				contactEmail: true,
				whatsappNumber: true,
				role: true,
				domain: true,
				price: true,
				currency: true,
				status: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		if (!application) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}

		res.json({ application });
	} catch (err) {
		next(err);
	}
};

// Admin: Get all applications
export const getAllApplications: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { page = 1, limit = 10, status } = req.query;
		const skip = (Number(page) - 1) * Number(limit);

		const where: any = {};
		if (status) {
			where.status = status;
		}

		const [applications, total] = await Promise.all([
			prisma.application.findMany({
				where,
				skip,
				take: Number(limit),
				orderBy: { createdAt: 'desc' },
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			}),
			prisma.application.count({ where }),
		]);

		res.json({
			applications,
			pagination: {
				page: Number(page),
				limit: Number(limit),
				total,
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (err) {
		next(err);
	}
};

// Admin: Update application status
export const updateApplicationStatus: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { id } = req.params;
		const parse = updateApplicationSchema.safeParse(req.body);

		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const { status } = parse.data;

		const application = await prisma.application.findUnique({
			where: { id },
		});

		if (!application) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}

		const updatedApplication = await prisma.application.update({
			where: { id },
			data: { status },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		res.json({
			message: 'Application status updated successfully',
			application: updatedApplication,
		});
	} catch (err) {
		next(err);
	}
};

// Get dashboard projects for the user based on their purchased plan, domain, and role
export const getUserDashboardProjects = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		// Find the user's active internship (assuming one active at a time)
		const internship = await prisma.internship.findFirst({
			where: {
				userId,
				status: 'ACTIVE',
			},
		});
		if (!internship) {
			res.status(404).json({ error: 'No active internship found for user.' });
			return;
		}
		// Find the matching project by domain and role, select only the new fields
		const project = await prisma.project.findFirst({
			where: {
				domain: internship.domain,
				role: internship.role,
			},
			select: {
				easyProjects: true,
				mediumProjects: true,
				hardProjects: true,
			},
		});
		if (!project) {
			res
				.status(404)
				.json({ error: 'No project found for user domain and role.' });
			return;
		}
		res.json({
			easyProjects: project.easyProjects,
			mediumProjects: project.mediumProjects,
			hardProjects: project.hardProjects,
		});
	} catch (err) {
		next(err);
	}
};
