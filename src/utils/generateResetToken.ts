import jwt from 'jsonwebtoken';

export function generateResetToken(email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}
