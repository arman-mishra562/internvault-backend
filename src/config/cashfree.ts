import { CFConfig, CFEnvironment, CFPaymentGateway } from "cashfree-pg-sdk-nodejs";

export const CASHFREE_CONFIG = {
    APP_ID: process.env.CASHFREE_APP_ID as string,
    SECRET_KEY: process.env.CASHFREE_SECRET_KEY as string,
    ENV: process.env.CASHFREE_ENV === 'PROD' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    CALLBACK_URL: process.env.CASHFREE_CALLBACK_URL || "",
    RETURN_URL: process.env.CASHFREE_RETURN_URL || "",
};

export function getCashfreeConfig() {
    return new CFConfig(
        CASHFREE_CONFIG.ENV,
        "2025-01-01", // Latest API version
        CASHFREE_CONFIG.APP_ID,
        CASHFREE_CONFIG.SECRET_KEY
    );
} 