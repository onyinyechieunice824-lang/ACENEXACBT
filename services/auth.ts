import { getApiUrl, FORCE_OFFLINE } from './config';
import { getDeviceFingerprint } from './device';

// --- SHA256 UTILITY ---
export const sha256 = async (message: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// --- TYPES ---
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
  device_fingerprint?: string | null;
  bound_at?: string | null;
  expires_at?: string | null;
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

// --- LOCAL STORAGE KEYS ---
const CURRENT_USER_KEY = 'jamb_cbt_current_user';
const LOCAL_USERS_KEY = 'jamb_cbt_local_users';
const LOCAL_TOKENS_KEY = 'jamb_cbt_local_tokens';
const LOCAL_ADMIN_KEY = 'jamb_cbt_local_admin';

// --- HELPERS ---
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

const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackError: string = "Timeout"): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(fallbackError)), ms);
    promise
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
};

const apiRequest = async (endpoint: string, method: string, body?: any) => {
  if (!navigator.onLine && !FORCE_OFFLINE) throw new Error("Network offline");
  if (FORCE_OFFLINE) throw new Error("Offline Mode Enforced");

  const url = getApiUrl(endpoint);
  try {
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

// --- LOCAL STORAGE HELPERS ---
const getLocalTokens = (): TokenInfo[] => {
  try { return JSON.parse(localStorage.getItem(LOCAL_TOKENS_KEY) || '[]'); } catch(e) { return []; }
};

const saveLocalToken = (token: TokenInfo) => {
  const tokens = getLocalTokens().filter(t => t.token_code !== token.token_code);
  tokens.unshift(token);
  localStorage.setItem(LOCAL_TOKENS_KEY, JSON.stringify(tokens));
};

const updateLocalToken = (tokenCode: string, updates: Partial<TokenInfo>) => {
  let tokens = getLocalTokens();
  tokens = tokens.map(t => t.token_code === tokenCode ? { ...t, ...updates } : t);
  localStorage.setItem(LOCAL_TOKENS_KEY, JSON.stringify(tokens));
};

const deleteLocalToken = (tokenCode: string) => {
  const tokens = getLocalTokens().filter(t => t.token_code !== tokenCode);
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

// --- TOKEN GENERATION ---
const generateSecureToken = (prefix: string = 'ACE') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 12;
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) result += chars.charAt(values[i] % chars.length);
  } else {
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result.substring(0,4)}-${result.substring(4,8)}-${result.substring(8,12)}`;
};

const verifyLocalToken = async (token: string, currentFingerprint: string, confirmBinding: boolean): Promise<User> => {
  const localTokens = getLocalTokens();
  const found = localTokens.find(t => t.token_code.toUpperCase() === token.trim().toUpperCase());
  if (!found) throw new Error("Offline: Invalid Access Code or not cached on this device.");
  if (!found.is_active) throw new Error("This token has been deactivated by Admin.");

  if (!found.device_fingerprint) {
    if (!confirmBinding) throw new Error("BINDING_REQUIRED");
    updateLocalToken(found.token_code, { device_fingerprint: currentFingerprint });
  } else if (found.device_fingerprint !== currentFingerprint) {
    throw new Error("⛔ ACCESS DENIED: This Access Code is locked to another device.");
  }

  const displayName = found.metadata?.full_name || 'Candidate (Offline)';
  return {
    username: found.token_code,
    role: 'student',
    fullName: displayName,
    regNumber: found.token_code,
    isTokenLogin: true,
    allowedExamType: (found.metadata?.exam_type as any) || 'BOTH'
  };
};

// --- TOKEN AUTH ---
export const loginWithToken = async (token: string, confirmBinding: boolean = false): Promise<User> => {
  let currentFingerprint = '';
  try { currentFingerprint = await withTimeout(getDeviceFingerprint(), 10000, "Device Identity Timeout"); } 
  catch { throw new Error("Could not verify device identity. Please refresh and try again."); }

  if (!FORCE_OFFLINE) {
    try {
      const res = await withTimeout(apiRequest('/api/auth/login-with-token','POST',{
        token,
        deviceFingerprint: currentFingerprint,
        confirm_binding: confirmBinding
      }),5000);

      if (res.requires_binding) throw new Error("BINDING_REQUIRED");

      const user = res as User;
      saveLocalToken({
        id:`cached-${Date.now()}`,
        token_code: token,
        is_active: true,
        created_at: new Date().toISOString(),
        device_fingerprint: currentFingerprint,
        metadata: { full_name: user.fullName, exam_type: user.allowedExamType, generated_by:'ONLINE_CACHE' }
      });
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return user;
    } catch(err: any) {
      if (err.message === "BINDING_REQUIRED") throw err;
    }
  }

  const user = await verifyLocalToken(token, currentFingerprint, confirmBinding);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return user;
};

// --- PAYSTACK OFFLINE SIMULATION ---
export const verifyPaystackPayment = async (reference: string, email: string, fullName: string, phoneNumber: string, examType: 'JAMB' | 'WAEC' | 'BOTH', amount: number) => {
  if (FORCE_OFFLINE) {
    const token = generateSecureToken('OFFLINE');
    saveLocalToken({
      id: Date.now().toString(),
      token_code: token,
      is_active: true,
      created_at: new Date().toISOString(),
      device_fingerprint: null,
      metadata: { payment_ref: reference, amount_paid: amount, exam_type: examType, email, full_name: fullName, phone_number: phoneNumber }
    });
    return { success: true, token };
  }
  return await apiRequest('/api/payments/verify-paystack','POST',{ reference,email,fullName,phoneNumber,examType });
};

// --- ADMIN/STUDENT LOGIN ---
export const loginUser = async (username: string, password: string, role: 'student' | 'admin'): Promise<User> => {
  // --- ADMIN OFFLINE ---
  if (role==='admin' && FORCE_OFFLINE) {
    let defaultAdmin = { username: 'admin', password: 'admin' };
    try {
      const stored = localStorage.getItem(LOCAL_ADMIN_KEY);
      if (stored) defaultAdmin = JSON.parse(stored);
      else {
        const hashed = await sha256(defaultAdmin.password);
        localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify({ username: defaultAdmin.username, password: hashed }));
        defaultAdmin.password = hashed;
      }
    } catch(e){ console.warn("Failed to load offline admin", e); }

    const hashedPassword = await sha256(password);
    if (username.toLowerCase()===defaultAdmin.username.toLowerCase() && hashedPassword===defaultAdmin.password) {
      const adminUser: User = { username: defaultAdmin.username, role:'admin', fullName:'System Administrator', regNumber:'ADMIN-001' };
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(adminUser));
      return adminUser;
    }
    throw new Error("Invalid Admin credentials (Offline)");
  }

  // --- STUDENT OFFLINE ---
  if (role==='student' && FORCE_OFFLINE) {
    const user = getLocalStudents().find(u=>u.username===username);
    if (user){ localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user)); return user; }
    throw new Error("Student not found in local database.");
  }

  // --- ONLINE LOGIN ---
  const user = await apiRequest('/api/auth/login','POST',{ username,password,role });
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return user;
};

// --- ADMIN CREDENTIAL UPDATE ---
export const updateAdminCredentials = async (currentUsername: string, currentPass: string, newUsername: string, newPass: string) => {
  if (FORCE_OFFLINE) {
    let adminCreds = { username:'admin', password:'admin' };
    try { const stored = localStorage.getItem(LOCAL_ADMIN_KEY); if(stored) adminCreds=JSON.parse(stored); } catch(e){}
    const hashedCurrent = await sha256(currentPass);
    if(currentUsername.toLowerCase()!==adminCreds.username.toLowerCase() || hashedCurrent!==adminCreds.password) throw new Error("Current admin credentials are incorrect.");
    const hashedNew = await sha256(newPass);
    localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify({ username:newUsername, password:hashedNew }));
    return;
  }
  await apiRequest('/api/auth/update-credentials','POST',{ currentUsername, currentPassword: currentPass, newUsername, newPassword: newPass, role:'admin' });
};

// --- STUDENT REGISTER/GET/DELETE ---
export const registerStudent = async (fullName: string, regNumber: string) => {
  if (FORCE_OFFLINE){ saveLocalStudent({ username:regNumber, role:'student', fullName, regNumber }); return { success:true }; }
  return await apiRequest('/api/auth/register','POST',{ fullName, regNumber });
};
export const getAllStudents = async (): Promise<User[]> => FORCE_OFFLINE ? getLocalStudents() : await apiRequest('/api/users/students','GET');
export const deleteStudent = async (username: string) => {
  if(FORCE_OFFLINE){ localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(getLocalStudents().filter(u=>u.username!==username))); return; }
  await apiRequest(`/api/users/${username}`,'DELETE');
};

// --- TOKEN MANAGEMENT (generate/delete/reset/toggle) ---
export const generateLocalTokenImmediate = (reference: string, amount: number, examType: string, fullName: string, phoneNumber: string) => {
  const token = generateSecureToken(FORCE_OFFLINE?'ACE':'LOCAL');
  saveLocalToken({
    id: Date.now().toString(),
    token_code: token,
    is_active: true,
    created_at: new Date().toISOString(),
    device_fingerprint: null,
    metadata: { payment_ref:reference||`MANUAL-${Date.now()}`, amount_paid: amount, exam_type: examType, full_name: fullName, phone_number: phoneNumber, generated_by:'ADMIN' }
  });
  return { success:true, token };
};
export const generateManualToken = async (reference:string, amount:number, examType:string, fullName:string, phoneNumber:string) => {
  if(!FORCE_OFFLINE) try { return await apiRequest('/api/admin/generate-token','POST',{ reference, amount, examType, fullName, phoneNumber }); } catch(e){ console.warn(e); }
  return generateLocalTokenImmediate(reference,amount,examType,fullName,phoneNumber);
};
export const toggleTokenStatus = async (tokenCode:string, isActive:boolean) => { updateLocalToken(tokenCode,{is_active:isActive}); if(!FORCE_OFFLINE) return await apiRequest('/api/admin/token-status','POST',{tokenCode,isActive}); return { success:true }; };
export const resetTokenDevice = async (tokenCode:string) => { updateLocalToken(tokenCode,{device_fingerprint:null}); if(!FORCE_OFFLINE) return await apiRequest('/api/admin/reset-token-device','POST',{tokenCode}); return { success:true }; };
export const deleteToken = async (tokenCode:string) => { deleteLocalToken(tokenCode); if(!FORCE_OFFLINE) await apiRequest(`/api/admin/tokens/${tokenCode}`,'DELETE'); return { success:true }; };
export const getAllTokens = async (): Promise<TokenInfo[]> => {
  let onlineTokens:TokenInfo[]=[];
  if(!FORCE_OFFLINE) try{onlineTokens=await apiRequest('/api/admin/tokens','GET');}catch(e){console.warn(e);}
  const localTokens = getLocalTokens();
  const combined = [...onlineTokens];
  localTokens.forEach(local=>{ if(!combined.find(c=>c.token_code===local.token_code)) combined.push(local); });
  return combined.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
};

// --- LOGOUT / GET CURRENT USER ---
export const logoutUser = () => localStorage.removeItem(CURRENT_USER_KEY);
export const getCurrentUser = (): User | null => { const stored = localStorage.getItem(CURRENT_USER_KEY); return stored?JSON.parse(stored):null; };
