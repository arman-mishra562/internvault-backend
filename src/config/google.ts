import { OAuth2Client } from 'google-auth-library';

// Create OAuth2 client for Google ID token verification
export const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Sign-In configuration
export const googleConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    scopes: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ]
};

// Verify Google ID token
export const verifyGoogleToken = async (idToken: string) => {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: googleConfig.clientId
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new Error('Invalid token payload');
        }

        return {
            sub: payload.sub,  // Google user ID
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            email_verified: payload.email_verified
        };
    } catch (error) {
        throw new Error('Invalid Google token');
    }
}; 