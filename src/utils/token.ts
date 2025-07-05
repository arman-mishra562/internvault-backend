import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export const generateAuthToken = (userId: string) => {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyAuthToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as { sub: string; iat: number; exp: number };
};
