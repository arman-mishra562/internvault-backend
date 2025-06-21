interface GeolocationResponse {
    country_code: string;
    country_name: string;
    currency: string;
}

export async function getCountryFromIP(ip: string): Promise<{ country: string; currency: string }> {
    try {
        console.log(`🔍 Attempting geolocation for IP: ${ip}`);

        // Use ip-api.com for free geolocation (1000 requests/minute)
        const url = `http://ip-api.com/json/${ip}?fields=countryCode,currency`;
        const response = await fetch(url);

        if (!response.ok) {
            console.log(`❌ Geolocation API failed with status: ${response.status}`);
            throw new Error('Failed to fetch geolocation data');
        }

        const data = await response.json();
        console.log(`📍 Geolocation response:`, data);

        const result = {
            country: data.countryCode || 'US',
            currency: data.currency || 'USD'
        };

        console.log(`✅ Final geolocation result:`, result);
        return result;
    } catch (error) {
        console.error('❌ Error fetching geolocation:', error);
        // Default fallback
        const fallback = {
            country: 'US',
            currency: 'USD'
        };
        console.log(`🔄 Using fallback:`, fallback);
        return fallback;
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