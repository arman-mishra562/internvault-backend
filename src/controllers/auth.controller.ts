import { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import transporter from '../config/mailer';
import { generateVerificationToken } from '../utils/generateVerificationToken';
import { generateUserId } from '../utils/generateUserId';
import { generateVerificationEmail, generateResetEmail } from '../utils/emailTemplates';
import { generateResetToken } from '../utils/generateResetToken';
import { generateAuthToken } from '../utils/token';
import { registerSchema, loginSchema, verifySchema, resendSchema } from '../schemas/auth.schema';

// Controller for user registration
export const register: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
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
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const token = generateVerificationToken(email);
    const expiry = new Date(Date.now() + 24 * 3600 * 1000);

    const newId = generateUserId();
    await prisma.user.create({
      data: { id: newId, name, email, password: hashed, emailToken: token, emailTokenExpiry: expiry },
    });

    const link = `${process.env.BACKEND_URL}/api/auth/verify?token=${token}`;
    await transporter.sendMail({
      from: `"InternVault" <${process.env.SMTP_USER}>`,
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
  next: NextFunction
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
  next: NextFunction
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

    const link = `${process.env.BACKEND_URL}/api/auth/verify?token=${token}`;
    await transporter.sendMail({
      from: `"InternVault" <${process.env.SMTP_USER}>`,
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
  next: NextFunction
): Promise<void> => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ errors: parse.error.flatten().fieldErrors });
      return;
    }

    const { email, password } = parse.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.isEmailVerified) {
      res.status(403).json({ error: 'Email not verified' });
      return;
    }

    const token = generateAuthToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
};

//  Forgot Password
export const forgotPassword: RequestHandler = async (req: Request,
  res: Response,
  next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.json({ message: "If that email is registered, you'll receive a reset link." });
      return;
    }
    const token = generateResetToken(email);
    const expiry = new Date(Date.now() + 3600 * 1000); // 1 hour
    await prisma.user.update({
      where: { id: user!.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: `"InternVault" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Password',
      html: generateResetEmail(link),
    });
    res.json({ message: "If that email is registered, you'll receive a reset link." });
  } catch (err) {
    next(err);
  }
};

// Reset Password
export const resetPassword: RequestHandler = async (req: Request,
  res: Response,
  next: NextFunction): Promise<void> => {
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
  next: NextFunction
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
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { password } = req.body;

    // Check if user exists and verify password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify password
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
