import { Router } from "express";
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  forgotPassword,
  resetPassword,
  deleteUser,
  googleAuth
} from '../controllers/auth.controller';
import validateRequest from '../middlewares/validateRequest';
import { isAuthenticated } from "../middlewares/auth.middleware";
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/password.schema';
import { deleteAccountSchema, googleAuthSchema } from "../schemas/auth.schema";

const router = Router();

router.post('/register', register);
router.get('/verify', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.post('/logout', logout);

// Google Sign-In route
router.post('/google/auth', validateRequest({ body: googleAuthSchema }), googleAuth);

router.post(
  '/forgot-password',
  validateRequest({ body: forgotPasswordSchema }),
  forgotPassword
);
router.post(
  '/reset-password',
  validateRequest({ body: resetPasswordSchema }),
  resetPassword
);

router.delete(
  '/delete-account',
  isAuthenticated,
  validateRequest({ body: deleteAccountSchema }),
  deleteUser
);

export default router;
