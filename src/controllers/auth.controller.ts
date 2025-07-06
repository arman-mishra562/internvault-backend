import { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { verify_transporter } from '../config/mailer';
import { generateVerificationToken } from '../utils/generateVerificationToken';
import { generateUserId } from '../utils/generateUserId';
import {
	generateVerificationEmail,
	generateResetEmail,
} from '../utils/emailTemplates';
import { generateResetToken } from '../utils/generateResetToken';
import { generateAuthToken } from '../utils/token';
import {
	registerSchema,
	loginSchema,
	verifySchema,
	resendSchema,
	googleAuthSchema,
} from '../schemas/auth.schema';
import { verifyGoogleToken } from '../config/google';

// Controller for user registration
export const register: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = registerSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const { name, email, password } = parse.data;
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			if (existing.isEmailVerified) {
				res.status(409).json({ error: 'Email already registered. Please proceed to login.' });
			} else {
				res.status(409).json({ error: 'Email registered but not verified. Please verify your account.' });
			}
			return;
		}

		const hashed = await bcrypt.hash(password, 10);
		const token = generateVerificationToken(email);
		const expiry = new Date(Date.now() + 24 * 3600 * 1000);

		const newId = generateUserId();
		await prisma.user.create({
			data: {
				id: newId,
				name,
				email,
				password: hashed,
				emailToken: token,
				emailTokenExpiry: expiry,
			},
		});

		const link = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
		await verify_transporter.sendMail({
			from: `"InternVault" <${process.env.SMTP_VERIFY_USER}>`,
			to: email,
			subject: 'Verify Your Email',
			html: generateVerificationEmail(link),
		});

		res.status(201).json({ message: 'Registered! Please check your email.' });
	} catch (err) {
		next(err);
	}
};

// Controller for email verification
export const verifyEmail: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = verifySchema.safeParse(req.query);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const { token } = parse.data;
		const user = await prisma.user.findFirst({ where: { emailToken: token } });
		if (!user || !user.emailTokenExpiry || user.emailTokenExpiry < new Date()) {
			res.status(400).json({ error: 'Invalid or expired token' });
			return;
		}

		await prisma.user.update({
			where: { id: user.id },
			data: { isEmailVerified: true, emailToken: null, emailTokenExpiry: null },
		});

		res.json({ message: 'Email verified successfully' });
	} catch (err) {
		next(err);
	}
};

// Controller to resend verification email
export const resendVerification: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = resendSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const { email } = parse.data;
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			res.status(404).json({ error: 'User not found' });
			return;
		}

		if (user.isEmailVerified) {
			res.status(400).json({ error: 'Email already verified' });
			return;
		}

		const token = generateVerificationToken(email);
		const expiry = new Date(Date.now() + 24 * 3600 * 1000);

		await prisma.user.update({
			where: { id: user.id },
			data: { emailToken: token, emailTokenExpiry: expiry },
		});

		const link = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
		await verify_transporter.sendMail({
			from: `"InternVault" <${process.env.SMTP_VERIFY_USER}>`,
			to: email,
			subject: 'Resend: Verify Your Email',
			html: generateVerificationEmail(link),
		});

		res.json({ message: 'Verification email resent' });
	} catch (err) {
		next(err);
	}
};

// Controller for user login
export const login: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = loginSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const { email, password } = parse.data;
		const user = await prisma.user.findUnique({ where: { email } });

		if (!user) {
			res.status(401).json({ error: 'Invalid credentials' });
			return;
		}

		// Check if user is OAuth-only (no password)
		if (user.oauthProvider && !user.password) {
			res.status(401).json({
				error:
					'This account was created with Google. Please sign in with Google instead.',
			});
			return;
		}

		// Check if user has password and verify it
		if (!user.password || !(await bcrypt.compare(password, user.password))) {
			res.status(401).json({ error: 'Invalid credentials' });
			return;
		}

		if (!user.isEmailVerified) {
			res.status(403).json({ error: 'Email not verified' });
			return;
		}

		const token = generateAuthToken(user.id);
		// Check if an application exists for this user with IN_PROGRESS status
		const applicationExists =
			(await prisma.application.findFirst({
				where: { userId: user.id, status: 'IN_PROGRESS' },
			})) !== null;
		res.json({
			token,
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				oauthProvider: user.oauthProvider,
				oauthPicture: user.oauthPicture,
			},
			hasApplication: applicationExists,
		});
	} catch (err) {
		next(err);
	}
};

//  Forgot Password
export const forgotPassword: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { email } = req.body;
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || !user.isEmailVerified) {
			res.json({
				message: "A reset link will be sent if the email is registered and verified. If not, please verify your account.",
			});
			return;
		}
		const token = generateResetToken(email);
		const expiry = new Date(Date.now() + 3600 * 1000); // 1 hour
		await prisma.user.update({
			where: { id: user!.id },
			data: { resetToken: token, resetTokenExpiry: expiry },
		});
		const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
		await verify_transporter.sendMail({
			from: `"InternVault" <${process.env.SMTP_VERIFY_USER}>`,
			to: email,
			subject: 'Reset Your Password',
			html: generateResetEmail(link),
		});
		res.json({
			message: "If that email is registered, you'll receive a reset link.",
		});
	} catch (err) {
		next(err);
	}
};

// Reset Password
export const resetPassword: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const { token, newPassword } = req.body;
		// find user with matching token
		const user = await prisma.user.findFirst({
			where: {
				resetToken: token,
				resetTokenExpiry: { gt: new Date() },
			},
		});
		if (!user) {
			res.status(400).json({ error: 'Invalid or expired token' });
		}
		const hashed = await bcrypt.hash(newPassword, 10);
		await prisma.user.update({
			where: { id: user!.id },
			data: {
				password: hashed,
				resetToken: null,
				resetTokenExpiry: null,
			},
		});
		res.json({ message: 'Password has been reset successfully' });
	} catch (err) {
		next(err);
	}
};

// user logout
export const logout: RequestHandler = async (
	_req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		// Stateless JWT – client discards token on their side
		res.json({ message: 'Logged out. Discard your token.' });
	} catch (err) {
		next(err);
	}
};

//deleting user
export const deleteUser: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const userId = (req as any).user.id;
		const { password } = req.body;

		// Check if user exists
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			res.status(404).json({ error: 'User not found' });
			return;
		}

		// For OAuth users without password, skip password verification
		if (user.oauthProvider && !user.password) {
			// Delete the user without password verification
			await prisma.user.delete({
				where: { id: userId },
			});
			res.status(200).json({ message: 'User deleted successfully' });
			return;
		}

		// For regular users, verify password
		if (!user.password) {
			res.status(400).json({ error: 'User has no password set' });
			return;
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			res.status(401).json({ error: 'Invalid password' });
			return;
		}

		// Delete the user
		await prisma.user.delete({
			where: { id: userId },
		});

		res.status(200).json({ message: 'User deleted successfully' });
	} catch (err) {
		next(err);
	}
};

// Google OAuth - Handle sign in/up
export const googleAuth: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const parse = googleAuthSchema.safeParse(req.body);
		if (!parse.success) {
			res.status(400).json({ errors: parse.error.flatten().fieldErrors });
			return;
		}

		const { idToken } = parse.data;

		// Verify the Google ID token
		const googleUser = await verifyGoogleToken(idToken);

		if (!googleUser.email_verified) {
			res.status(400).json({ error: 'Google email not verified' });
			return;
		}

		// Ensure required fields are present
		if (!googleUser.email || !googleUser.name || !googleUser.sub) {
			res.status(400).json({ error: 'Invalid Google user data' });
			return;
		}

		// Check if user already exists
		let user = await prisma.user.findFirst({
			where: {
				OR: [
					{ email: googleUser.email },
					{
						oauthProvider: 'google',
						oauthId: googleUser.sub,
					},
				],
			},
		});

		if (user) {
			// User exists - update OAuth info if needed
			if (!user.oauthProvider || !user.oauthId) {
				await prisma.user.update({
					where: { id: user.id },
					data: {
						oauthProvider: 'google',
						oauthId: googleUser.sub,
						oauthPicture: googleUser.picture || null,
						isEmailVerified: true, // Google emails are pre-verified
					},
				});
			}
		} else {
			// Create new user
			const newId = generateUserId();
			user = await prisma.user.create({
				data: {
					id: newId,
					name: googleUser.name,
					email: googleUser.email,
					oauthProvider: 'google',
					oauthId: googleUser.sub,
					oauthPicture: googleUser.picture || null,
					isEmailVerified: true, // Google emails are pre-verified
				},
			});
		}

		// Generate JWT token
		const token = generateAuthToken(user.id);

		// Check if an application exists for this user with IN_PROGRESS status
		const applicationExists =
			(await prisma.application.findFirst({
				where: { userId: user.id, status: 'IN_PROGRESS' },
			})) !== null;

		res.json({
			token,
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				oauthProvider: user.oauthProvider,
				oauthPicture: user.oauthPicture,
			},
			hasApplication: applicationExists,
		});
	} catch (err) {
		next(err);
	}
};
