import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../config/prisma';
import {
	applicationSchema,
	updateApplicationSchema,
	projectSubmissionSchema,
	projectApprovalSchema,
} from '../schemas/application.schema';
import { getPointsForDifficulty, getTargetPointsForDuration } from '../utils/points';

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
			duration,
			price,
			currency,
		} = parse.data;

		// Check if user has any PENDING or IN_PROGRESS applications
		const activeApplication = await prisma.application.findFirst({
			where: {
				userId,
				status: { in: ['PENDING', 'IN_PROGRESS'] },
			},
		});

		if (activeApplication) {
			res.status(400).json({
				error: 'You already have an active application. Please complete or cancel your current application before creating a new one.'
			});
			return;
		}

		// Create new application
		const application = await prisma.application.create({
			data: {
				fullName,
				contactEmail,
				whatsappNumber,
				role,
				domain,
				duration,
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

		// Assign projects based on domain, role, and duration
		await assignProjectsToApplication(application.id, domain, role, duration);

		res.status(201).json({
			message: 'Application submitted successfully',
			application: {
				id: application.id,
				fullName: application.fullName,
				contactEmail: application.contactEmail,
				whatsappNumber: application.whatsappNumber,
				role: application.role,
				domain: application.domain,
				duration: application.duration,
				price: application.price,
				currency: application.currency,
				status: application.status,
				hasProjectCertificate: application.hasProjectCertificate,
				hasInternshipCertificate: application.hasInternshipCertificate,
				createdAt: application.createdAt,
			},
		});
	} catch (err) {
		next(err);
	}
};

// Helper function to assign projects to application
async function assignProjectsToApplication(applicationId: string, domain: string, role: string, duration: number) {
	try {
		// Find projects that match the domain and role
		const projects = await prisma.project.findMany({
			where: {
				domain: { equals: domain, mode: 'insensitive' },
				role: { equals: role, mode: 'insensitive' },
			},
		});

		// Group projects by difficulty
		const grouped: { [key: string]: any } = {};
		for (const project of projects) {
			if (!grouped[project.difficulty]) {
				grouped[project.difficulty] = project;
			}
		}

		// Only one project per difficulty (EASY, NORMAL, HARD)
		const selectedProjects = ['EASY', 'NORMAL', 'HARD']
			.map(diff => grouped[diff])
			.filter(Boolean)
			.slice(0, 3); // Max three projects

		// Create project assignments
		const assignments = selectedProjects.map(project => ({
			applicationId,
			projectId: project.id,
		}));

		if (assignments.length > 0) {
			await prisma.applicationProject.createMany({
				data: assignments,
			});
		}
	} catch (error) {
		console.error('Error assigning projects:', error);
	}
}

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
				duration: true,
				price: true,
				currency: true,
				status: true,
				hasProjectCertificate: true,
				hasInternshipCertificate: true,
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
				duration: true,
				price: true,
				currency: true,
				status: true,
				hasProjectCertificate: true,
				hasInternshipCertificate: true,
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

// Get all applications (admin only)
export const getAllApplications: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const applications = await prisma.application.findMany({
			orderBy: { createdAt: 'desc' },
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				projectAssignments: {
					include: {
						project: true,
					},
				},
			},
		});

		res.json({ applications });
	} catch (err) {
		next(err);
	}
};

// Update application status (admin only)
export const updateApplicationStatus: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = updateApplicationSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const { id } = req.params;
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
		});

		res.json({
			message: 'Application status updated successfully',
			application: updatedApplication,
		});
	} catch (err) {
		next(err);
	}
};

// Get user's assigned projects
export const getUserProjects: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		const { applicationId } = req.params;

		// Verify the application belongs to the user
		const application = await prisma.application.findFirst({
			where: {
				id: applicationId,
				userId,
			},
		});

		if (!application) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}

		const projects = await prisma.applicationProject.findMany({
			where: { applicationId },
			include: {
				project: true,
			},
			orderBy: { createdAt: 'asc' },
		});

		// Only return application id and user id, and the projects
		res.json({
			application: {
				id: application.id,
				userId: application.userId,
			},
			projects,
		});
	} catch (err) {
		next(err);
	}
};

// Submit project solution
export const submitProject: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = projectSubmissionSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const userId = (req as any).user.id;
		const { applicationId, projectId } = req.params;
		const { submissionUrl } = parse.data;

		// Verify the application belongs to the user
		const application = await prisma.application.findFirst({
			where: {
				id: applicationId,
				userId,
			},
		});

		if (!application) {
			res.status(404).json({ error: 'Application not found' });
			return;
		}

		// Find the project assignment
		const projectAssignment = await prisma.applicationProject.findFirst({
			where: {
				applicationId,
				projectId,
			},
		});

		if (!projectAssignment) {
			res.status(404).json({ error: 'Project assignment not found' });
			return;
		}

		// Update project submission
		const updatedProject = await prisma.applicationProject.update({
			where: {
				id: projectAssignment.id,
			},
			data: {
				submissionUrl,
				submittedAt: new Date(),
			},
			include: {
				project: true,
			},
		});

		// Check and update application status if needed
		if (application.status === 'PENDING') {
			await prisma.application.update({
				where: { id: applicationId },
				data: { status: 'IN_PROGRESS' },
			});
		}

		res.json({
			message: 'Project submitted successfully',
			project: updatedProject,
		});
	} catch (err) {
		next(err);
	}
};

// Approve/reject project (admin only)
export const approveProject: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = projectApprovalSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const adminId = (req as any).user.id;
		const { applicationId, projectId } = req.params;
		const { approved } = parse.data;

		// Find the project assignment
		const projectAssignment = await prisma.applicationProject.findFirst({
			where: {
				applicationId,
				projectId,
			},
			include: { project: true },
		});

		if (!projectAssignment) {
			res.status(404).json({ error: 'Project assignment not found' });
			return;
		}

		// Assign points based on difficulty if approved
		const points = approved ? getPointsForDifficulty(projectAssignment.project.difficulty) : 0;

		// Update project approval status
		const updatedProject = await prisma.applicationProject.update({
			where: {
				id: projectAssignment.id,
			},
			data: {
				approved,
				approvedAt: approved ? new Date() : null,
				approvedBy: approved ? adminId : null,
				points,
			},
			include: {
				project: true,
			},
		});

		// If approved, recalculate total approved points for the application
		if (approved) {
			const approvedProjects = await prisma.applicationProject.findMany({
				where: { applicationId, approved: true },
			});
			const totalPoints = approvedProjects.reduce((sum, p) => sum + (p.points || 0), 0);

			// Get application and target points
			const application = await prisma.application.findUnique({ where: { id: applicationId } });
			if (!application) {
				res.status(404).json({ error: 'Application not found' });
				return;
			}
			const targetPoints = getTargetPointsForDuration(application.duration);

			// If target points achieved, set hasProjectCertificate
			if (!application.hasProjectCertificate && totalPoints >= targetPoints) {
				await prisma.application.update({
					where: { id: applicationId },
					data: { hasProjectCertificate: true },
				});

				// If payment is completed, set hasInternshipCertificate
				if (application.isPaid && !application.hasInternshipCertificate) {
					await prisma.application.update({
						where: { id: applicationId },
						data: { hasInternshipCertificate: true },
					});
				}
			}
		}

		res.json({
			message: `Project ${approved ? 'approved' : 'rejected'} successfully`,
			project: updatedProject,
		});
	} catch (err) {
		next(err);
	}
};

// Get application with all project details
export const getApplicationWithProjects: RequestHandler = async (
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
			include: {
				projectAssignments: {
					include: {
						project: true,
					},
					orderBy: { createdAt: 'asc' },
				},
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

// Add a new controller for deleting an application
export const deleteApplication: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		const { id } = req.params;
		// Only allow deletion if application belongs to user and is not IN_PROGRESS or COMPLETED
		const application = await prisma.application.findFirst({
			where: {
				id,
				userId,
				status: { in: ['PENDING'] },
			},
		});
		if (!application) {
			res.status(403).json({ error: 'Application cannot be deleted (not found or already in progress/completed).' });
			return;
		}
		await prisma.application.delete({ where: { id } });
		res.json({ message: 'Application deleted successfully.' });
	} catch (err) {
		next(err);
	}
};
