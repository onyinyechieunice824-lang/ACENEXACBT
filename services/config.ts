// configuration for API connection
const LOCAL_BACKEND = "http://localhost:5000"; // only for local dev if needed
const PROD_BACKEND = "https://acenexacbt.onrender.com";

// Detect environment
const IS_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Default backend
export const BACKEND_URL = IS_LOCAL ? LOCAL_BACKEND : PROD_BACKEND;

// Force offline (keep false for real deployment)
export const FORCE_OFFLINE = false;

// PAYSTACK PUBLIC KEY (LIVE key, replace with your live key)
export const PAYSTACK_PUBLIC_KEY = "pk_live_6285198feb88d1bf9515732e6eea990012a8344e"; 

export const getApiUrl = (endpoint: string) => {
    const base = BACKEND_URL.replace(/\/$/, '');
    return `${base}${endpoint}`;
}
