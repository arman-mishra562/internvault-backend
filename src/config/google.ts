import { OAuth2Client } from 'google-auth-library';

// Create OAuth2 client for Google
export const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Google OAuth configuration
export const googleConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    scopes: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ]
};

// Generate Google OAuth URL
export const getGoogleAuthUrl = (): string => {
    return googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: googleConfig.scopes,
        prompt: 'consent'
    });
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
            sub: payload.sub, // Google user ID
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            email_verified: payload.email_verified
        };
    } catch (error) {
        throw new Error('Invalid Google token');
    }
}; 