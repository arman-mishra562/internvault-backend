import { v4 as uuidv4 } from 'uuid';

export function generateUserId(): string {
	const suffix = uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
	return `${process.env.USERID_PREFIX}${suffix}`;
}
