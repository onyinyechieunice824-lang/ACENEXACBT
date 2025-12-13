
// configuration for API connection

// Your Render Backend URL
export const BACKEND_URL = "https://ebus-edu-consult-backend.onrender.com"; 

// SET THIS TO TRUE TO DISABLE BACKEND AND USE LOCAL STORAGE ONLY
// Change to 'false' when you want to connect to the real server.
export const FORCE_OFFLINE = false; 

// --- PAYSTACK PUBLIC KEY ---
// Paste your "Public Key" from Paystack Dashboard here.
// It usually starts with "pk_live_" or "pk_test_"
export const PAYSTACK_PUBLIC_KEY = "pk_live_6285198feb88d1bf9515732e6eea990012a8344e"; 

export const getApiUrl = (endpoint: string) => {
    // Ensure no double slashes if BACKEND_URL ends with /
    const base = BACKEND_URL.replace(/\/$/, '');
    return `${base}${endpoint}`;
};
