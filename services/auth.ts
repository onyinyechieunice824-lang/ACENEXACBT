
import { getApiUrl, FORCE_OFFLINE } from './config';
import { getDeviceFingerprint } from './device';

export interface User {
  username: string;
  role: 'student' | 'admin';
  fullName?: string;
  regNumber?: string;
  isTokenLogin?: boolean;
  allowedExamType?: 'JAMB' | 'WAEC' | 'BOTH';
}

export interface TokenInfo {
    id: string;
    token_code: string;
    is_active: boolean;
    created_at: string;
    device_fingerprint?: string | null; // Stores the unique device hash
    metadata: {
        payment_ref?: string;
        amount_paid?: number;
        exam_type?: string;
        full_name?: string;
        phone_number?: string;
        email?: string;
        generated_by?: string;
        [key: string]: any;
    };
}

const CURRENT_USER_KEY = 'jamb_cbt_current_user';
const LOCAL_USERS_KEY = 'jamb_cbt_local_users';
const LOCAL_TOKENS_KEY = 'jamb_cbt_local_tokens';
const LOCAL_ADMIN_KEY = 'jamb_cbt_local_admin';

// Helper for timeouts
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// Generic timeout wrapper for any promise
const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackError: string = "Timeout"): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(fallbackError)), ms);
        promise
            .then(res => { clearTimeout(timer); resolve(res); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
};

const apiRequest = async (endpoint: string, method: string, body?: any) => {
    // Fast fail if we are definitely offline
    if (!navigator.onLine && !FORCE_OFFLINE) {
        throw new Error("Network offline");
    }

    if (FORCE_OFFLINE) throw new Error("Offline Mode Enforced");

    const url = getApiUrl(endpoint);
    try {
        // Reduced timeout to 5s to fail faster to offline mode
        const res = await fetchWithTimeout(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        }, 5000); 
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error(`Non-JSON response (Status ${res.status})`);
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'API Request Failed');
        return data;
    } catch (err: any) {
        throw err;
    }
};

// --- LOCAL STORAGE HELPERS (FOR OFFLINE MODE) ---
const getLocalTokens = (): TokenInfo[] => {
    try { return JSON.parse(localStorage.getItem(LOCAL_TOKENS_KEY) || '[]'); } catch(e) { return []; }
};
const saveLocalToken = (token: TokenInfo) => {
    const tokens = getLocalTokens();
    // Remove duplicates if any
    const filtered = tokens.filter(t => t.token_code !== token.token_code);
    filtered.unshift(token);
    localStorage.setItem(LOCAL_TOKENS_KEY, JSON.stringify(filtered));
};
const updateLocalToken = (tokenCode: string, updates: Partial<TokenInfo>) => {
    let tokens = getLocalTokens();
    tokens = tokens.map(t => t.token_code === tokenCode ? { ...t, ...updates } : t);
    localStorage.setItem(LOCAL_TOKENS_KEY, JSON.stringify(tokens));
};
const deleteLocalToken = (tokenCode: string) => {
    let tokens = getLocalTokens();
    tokens = tokens.filter(t => t.token_code !== tokenCode);
    localStorage.setItem(LOCAL_TOKENS_KEY, JSON.stringify(tokens));
};
const getLocalStudents = (): User[] => {
    try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]'); } catch(e) { return []; }
};
const saveLocalStudent = (user: User) => {
    const users = getLocalStudents();
    users.push(user);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
};

// --- SECURE TOKEN GENERATOR ---
const generateSecureToken = (prefix: string = 'ACE') => {
    // Generates a format like: PREFIX-XXXX-XXXX-XXXX
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0
    const length = 12; // Increased entropy to 12 chars
    let result = '';
    
    // Use crypto for better randomness if available
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const values = new Uint32Array(length);
        crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            result += chars.charAt(values[i] % chars.length);
        }
    } else {
        // Fallback for older environments
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    
    // Split into 3 groups of 4 for readability
    return `${prefix}-${result.substring(0, 4)}-${result.substring(4, 8)}-${result.substring(8, 12)}`;
};

// Helper: Verify token against local storage
const verifyLocalToken = async (token: string, currentFingerprint: string, confirmBinding: boolean): Promise<User> => {
    const localTokens = getLocalTokens();
    // Case-insensitive search
    const found = localTokens.find(t => t.token_code.toUpperCase() === token.trim().toUpperCase());
    
    if (found) {
        if (!found.is_active) throw new Error("This token has been deactivated by Admin.");
        
        // --- DEVICE LOCK CHECK (OFFLINE) ---
        if (!found.device_fingerprint) {
            // Check for confirmation
            if (!confirmBinding) {
                throw new Error("BINDING_REQUIRED");
            }
            // First time use: LOCK to this device
            console.log(`Binding token ${token} to device ${currentFingerprint}`);
            updateLocalToken(found.token_code, { device_fingerprint: currentFingerprint });
        } else if (found.device_fingerprint !== currentFingerprint) {
            // Subsequent use: Check lock
            console.warn(`Device Mismatch! Token Locked to: ${found.device_fingerprint}, Current: ${currentFingerprint}`);
            throw new Error("⛔ ACCESS DENIED: This Access Code is locked to another device. You cannot use it here.");
        }
        // -----------------------------------

        // Use name from metadata if available
        const displayName = found.metadata?.full_name || 'Candidate (Offline)';
        
        return {
            username: found.token_code,
            role: 'student',
            fullName: displayName,
            regNumber: found.token_code,
            isTokenLogin: true,
            allowedExamType: (found.metadata?.exam_type as any) || 'BOTH'
        };
    }
    throw new Error("Offline: Invalid Access Code or not cached on this device.");
};

// --- TOKEN AUTH ---
export const loginWithToken = async (token: string, confirmBinding: boolean = false): Promise<User> => {
    // 1. Generate unique device signature 
    let currentFingerprint = '';
    try {
        currentFingerprint = await withTimeout(getDeviceFingerprint(), 10000, "Device Identity Timeout");
    } catch (e) {
        console.error("Device fingerprinting failed:", e);
        throw new Error("Could not verify device identity. Please refresh and try again.");
    }

    // 2. Try Online Login first
    if (!FORCE_OFFLINE) {
        try {
            // Wrap in hard timeout of 5s for the whole operation
            const res = await withTimeout(
                apiRequest('/api/auth/login-with-token', 'POST', { 
                    token, 
                    deviceFingerprint: currentFingerprint,
                    confirm_binding: confirmBinding 
                }), 
                5000
            );

            if (res.requires_binding) {
                throw new Error("BINDING_REQUIRED");
            }

            const user = res as User;
            
            // --- NEW: Persist token locally for offline use ---
            const localTokenEntry: TokenInfo = {
                id: `cached-${Date.now()}`,
                token_code: token,
                is_active: true, // It worked online, so it's active
                created_at: new Date().toISOString(),
                device_fingerprint: currentFingerprint,
                metadata: {
                    full_name: user.fullName,
                    exam_type: user.allowedExamType,
                    generated_by: 'ONLINE_CACHE'
                }
            };
            saveLocalToken(localTokenEntry);
            // ------------------------------------------------

            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
            return user;
        } catch (err: any) {
            if (err.message === "BINDING_REQUIRED") throw err; // Re-throw binding requirement

            console.warn("Online login failed, attempting local fallback...", err.message);
            // If online fails (404, 401, or Network Error), fall through to local check
        }
    }

    // 3. Fallback to Local Login
    try {
        const user = await verifyLocalToken(token, currentFingerprint, confirmBinding);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
    } catch (localErr: any) {
        // If both failed, throw valid error
        throw new Error(localErr.message || "Invalid Token or Device Mismatch");
    }
};

export const verifyPaystackPayment = async (reference: string, email: string, fullName: string, phoneNumber: string, examType: 'JAMB' | 'WAEC' | 'BOTH', amount: number) => {
    if (FORCE_OFFLINE) {
        // Simulate in offline mode (Development only)
        const token = generateSecureToken('OFFLINE');
        saveLocalToken({
            id: Date.now().toString(),
            token_code: token,
            is_active: true,
            created_at: new Date().toISOString(),
            device_fingerprint: null,
            metadata: { 
                payment_ref: reference, 
                amount_paid: amount, 
                exam_type: examType,
                email,
                full_name: fullName,
                phone_number: phoneNumber
            }
        });
        return { success: true, token };
    }

    try {
        // REAL VERIFICATION: Send reference to backend
        const response = await apiRequest('/api/payments/verify-paystack', 'POST', { 
            reference, 
            email, 
            fullName, 
            phoneNumber,
            examType // Pass the selected package type
        });
        return response; // Contains { success: true, token: "..." }
    } catch (err: any) {
        throw err;
    }
};

/**
 * Synchronously generates a token and saves to local storage.
 * Used when API is unreachable or times out.
 */
export const generateLocalTokenImmediate = (reference: string, amount: number, examType: string, fullName: string, phoneNumber: string) => {
    const prefix = FORCE_OFFLINE ? 'ACE' : 'LOCAL';
    const token = generateSecureToken(prefix);
    
    saveLocalToken({
        id: Date.now().toString(),
        token_code: token,
        is_active: true,
        created_at: new Date().toISOString(),
        device_fingerprint: null, // Initially unlocked
        metadata: { 
            payment_ref: reference || `MANUAL-${Date.now()}`, 
            amount_paid: amount, 
            exam_type: examType,
            full_name: fullName,
            phone_number: phoneNumber,
            generated_by: 'ADMIN'
        }
    });
    return { success: true, token };
};

export const generateManualToken = async (reference: string, amount: number, examType: string, fullName: string, phoneNumber: string) => {
    // 1. Attempt Online Generation
    if (!FORCE_OFFLINE) {
        try {
            return await apiRequest('/api/admin/generate-token', 'POST', { reference, amount, examType, fullName, phoneNumber });
        } catch(err: any) {
            console.warn("Online generation failed. Falling back to local generation.", err);
            // Fall through to offline logic
        }
    }

    // 2. Offline / Fallback Generation
    return generateLocalTokenImmediate(reference, amount, examType, fullName, phoneNumber);
};

export const toggleTokenStatus = async (tokenCode: string, isActive: boolean) => {
    // Try online, always update local as well for consistency
    updateLocalToken(tokenCode, { is_active: isActive });

    if (!FORCE_OFFLINE) {
        try {
            return await apiRequest('/api/admin/token-status', 'POST', { tokenCode, isActive });
        } catch(err: any) {
            console.warn("Online status toggle failed (saved locally)");
        }
    }
    return { success: true };
};

export const resetTokenDevice = async (tokenCode: string) => {
    // Try online, always update local
    updateLocalToken(tokenCode, { device_fingerprint: null });

    if (!FORCE_OFFLINE) {
        try {
            return await apiRequest('/api/admin/reset-token-device', 'POST', { tokenCode });
        } catch(err: any) {
            console.warn("Online reset failed (saved locally)");
        }
    }
    return { success: true };
};

export const deleteToken = async (tokenCode: string) => {
    // Always delete locally
    deleteLocalToken(tokenCode);

    if (!FORCE_OFFLINE) {
        try {
            await apiRequest(`/api/admin/tokens/${tokenCode}`, 'DELETE');
        } catch(err: any) {
            console.warn("Online delete failed (deleted locally)");
        }
    }
    return { success: true };
};

export const getAllTokens = async (): Promise<TokenInfo[]> => {
    let onlineTokens: TokenInfo[] = [];
    
    if (!FORCE_OFFLINE) {
        try {
            onlineTokens = await apiRequest('/api/admin/tokens', 'GET');
        } catch(e) { 
            console.warn("Failed to fetch online tokens");
        }
    }
    
    const localTokens = getLocalTokens();
    
    // Merge: Prefer online, but include local-only tokens (those generated while offline)
    // Simple merge: Concat and dedupe by token_code
    const combined = [...onlineTokens];
    
    localTokens.forEach(local => {
        if (!combined.find(c => c.token_code === local.token_code)) {
            combined.push(local);
        }
    });

    return combined.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// --- LEGACY/ADMIN AUTH ---
export const registerStudent = async (fullName: string, regNumber: string) => {
    if (FORCE_OFFLINE) {
        saveLocalStudent({
            username: regNumber,
            role: 'student',
            fullName,
            regNumber
        });
        return { success: true };
    }
    try {
        return await apiRequest('/api/auth/register', 'POST', { fullName, regNumber });
    } catch(e) { console.warn("Register failed"); }
};

export const getAllStudents = async (): Promise<User[]> => {
    if (FORCE_OFFLINE) {
        return getLocalStudents();
    }
    try {
        return await apiRequest('/api/users/students', 'GET');
    } catch(e) { return []; }
};

export const deleteStudent = async (username: string) => {
    if (FORCE_OFFLINE) {
        const users = getLocalStudents().filter(u => u.username !== username);
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
        return;
    }
    try { await apiRequest(`/api/users/${username}`, 'DELETE'); } catch(e){}
};

export const loginUser = async (username: string, password: string, role: 'student' | 'admin'): Promise<User> => {
    // 1. Admin Login (Offline Check ONLY if FORCE_OFFLINE is true)
    if (role === 'admin' && FORCE_OFFLINE) {
         // Default admin credentials for pure offline mode
         let adminCreds = { username: 'admin', password: 'admin' };
         try {
             const stored = localStorage.getItem(LOCAL_ADMIN_KEY);
             if (stored) adminCreds = JSON.parse(stored);
         } catch(e) {}

         if (username.toLowerCase() === adminCreds.username.toLowerCase() && password === adminCreds.password) {
             const adminUser: User = { 
                 username: adminCreds.username, 
                 role: 'admin', 
                 fullName: 'System Administrator',
                 regNumber: 'ADMIN-001'
             };
             localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(adminUser));
             return adminUser;
         }
         throw new Error("Invalid Admin credentials (Offline)");
    }

    // 2. Local Student Login (Offline)
    if (role === 'student' && FORCE_OFFLINE) {
        const users = getLocalStudents();
        const user = users.find(u => u.username === username);
        if (user) {
             localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
             return user;
        }
        throw new Error("Student not found in local database.");
    }

    // 3. Online Login (Database Check)
    try {
        const user = await apiRequest('/api/auth/login', 'POST', { username, password, role });
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
    } catch (err: any) {
         throw err;
    }
};

export const updateAdminCredentials = async (currentUsername: string, currentPass: string, newUsername: string, newPass: string) => {
    // 1. Offline Mode Update
    if (FORCE_OFFLINE) {
        let adminCreds = { username: 'admin', password: 'admin' };
        try {
            const stored = localStorage.getItem(LOCAL_ADMIN_KEY);
            if (stored) adminCreds = JSON.parse(stored);
        } catch(e) {}

        if (currentUsername.toLowerCase() !== adminCreds.username.toLowerCase() || currentPass !== adminCreds.password) {
            throw new Error("Current admin credentials are incorrect.");
        }

        const newCreds = { username: newUsername, password: newPass };
        localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(newCreds));
        return;
    }

    // 2. Online Mode Update (Backend Call)
    try {
        await apiRequest('/api/auth/update-credentials', 'POST', {
            currentUsername,
            currentPassword: currentPass,
            newUsername,
            newPassword: newPass,
            role: 'admin'
        });
    } catch (err: any) {
        throw err;
    }
};

export const changePassword = async (username: string, oldPass: string, newPass: string, role: 'student' | 'admin') => {
    if (FORCE_OFFLINE) {
        console.log("Password change simulated locally");
        return;
    }
    // Implement student password change if needed
};

export const resetAdminPassword = (newPass: string) => {
   alert("Please update the admin password directly in the database (Users table).");
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  return stored ? JSON.parse(stored) : null;
};
