const LOCAL_BACKEND = "http://localhost:5000";
const PROD_BACKEND = "https://acenexacbt.onrender.com";

// Detect environment
const IS_LOCAL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Default backend
export const BACKEND_URL = IS_LOCAL ? LOCAL_BACKEND : PROD_BACKEND;

// Offline switch
export const FORCE_OFFLINE = false;

// Paystack (public key)
export const PAYSTACK_PUBLIC_KEY =
  "pk_live_6285198feb88d1bf9515732e6eea990012a8344e";

export const getApiUrl = (endpoint: string) => {
  const base = BACKEND_URL.replace(/\/$/, "");
  return `${base}${endpoint}`;
};
