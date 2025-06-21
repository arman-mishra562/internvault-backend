interface GeolocationResponse {
    country_code: string;
    country_name: string;
    currency: string;
}

export async function getCountryFromIP(ip: string): Promise<{ country: string; currency: string }> {
    try {
        // Use ipapi.co for free geolocation
        const response = await fetch(`https://ipapi.co/${ip}/json/`);

        if (!response.ok) {
            throw new Error('Failed to fetch geolocation data');
        }

        const data: GeolocationResponse = await response.json();

        return {
            country: data.country_code || 'US',
            currency: data.currency || 'USD'
        };
    } catch (error) {
        console.error('Error fetching geolocation:', error);
        // Default fallback
        return {
            country: 'US',
            currency: 'USD'
        };
    }
}

export function getClientIP(req: any): string {
    // Get IP from various headers (for different proxy setups)
    const ip = req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        '127.0.0.1';

    // Handle multiple IPs in x-forwarded-for header
    return Array.isArray(ip) ? ip[0] : ip.split(',')[0].trim();
} 