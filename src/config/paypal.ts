import axios from 'axios';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID as string;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET as string;
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

export async function getPaypalAccessToken(): Promise<string> {
    const response = await axios.post(
        `${PAYPAL_API_BASE}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
            auth: {
                username: PAYPAL_CLIENT_ID,
                password: PAYPAL_CLIENT_SECRET,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }
    );
    return response.data.access_token;
}

export { PAYPAL_API_BASE }; 