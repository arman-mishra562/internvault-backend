import jwt from 'jsonwebtoken';

export const generateVerificationToken = (userId: string) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '24h' });
  return token;
};
