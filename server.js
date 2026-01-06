import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------
// CORS CONFIG
// ------------------------
const allowedOrigins = [
  'https://acenexacbt.vercel.app',   // New frontend
  'https://acenexacbt.onrender.com', // New backend
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) return callback(null, true);
    return callback(null, true);
  }
}));

app.use(express.json({ limit: '50mb' }));

// ------------------------
// SUPABASE CONFIG
// ------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: Missing Supabase credentials in Environment Variables.");
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder', 
  { auth: { persistSession: false } }
);

// ------------------------
// HELPER FUNCTIONS
// ------------------------
const generateAccessCode = (prefix = 'ACE') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 12;
  const randomBytes = crypto.randomBytes(length);

  let result = '';
  for (let i = 0; i < length; i++) {
    const index = randomBytes[i] % chars.length;
    result += chars[index];
  }
  return `${prefix}-${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}`;
};

// Calculate remaining days
const getRemainingDays = (expires_at: string | null) => {
  if (!expires_at) return null;
  const expiry = new Date(expires_at);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ------------------------
// HEALTH CHECK
// ------------------------
app.get('/health', (req, res) => res.status(200).send('OK'));

// ------------------------
// PAYMENT VERIFICATION & TOKEN GENERATION
// ------------------------
app.post('/api/payments/verify-paystack', async (req, res) => {
  const { reference, email, fullName, phoneNumber, examType } = req.body;

  if (!reference) return res.status(400).json({ error: "Missing transaction reference." });
  if (!paystackSecretKey) return res.status(500).json({ error: "Missing Paystack Key" });

  try {
    const { data: existingToken } = await supabase
      .from('access_tokens')
      .select('token_code, is_active')
      .eq('metadata->>payment_ref', reference)
      .single();

    if (existingToken) {
      return res.json({ success: true, token: existingToken.token_code, message: "Payment already verified." });
    }

    const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` }
    });

    const data = verifyRes.data.data;
    if (data.status !== 'success') return res.status(400).json({ error: "Payment failed." });
    if (data.amount < 150000) return res.status(400).json({ error: "Invalid amount." });

    const tokenCode = generateAccessCode('ACE');
    const finalExamType = examType || 'BOTH';

    const { data: dbData, error } = await supabase
      .from('access_tokens')
      .insert([{
        token_code: tokenCode,
        is_active: true,
        device_fingerprint: null,
        metadata: {
          payment_ref: reference,
          amount_paid: data.amount / 100,
          exam_type: finalExamType,
          full_name: fullName,
          phone_number: phoneNumber,
          email,
          paystack_id: data.id,
          verified_at: new Date().toISOString()
        }
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, token: dbData.token_code });
  } catch (err) {
    console.error("Verification Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Could not verify payment." });
  }
});

// ------------------------
// ADMIN TOKEN MANAGEMENT
// ------------------------
app.post('/api/admin/generate-token', async (req, res) => {
  const { reference, amount, examType, fullName, phoneNumber } = req.body;
  try {
    const tokenCode = generateAccessCode('ACE');
    const { data, error } = await supabase
      .from('access_tokens')
      .insert([{
        token_code: tokenCode,
        is_active: true,
        device_fingerprint: null,
        metadata: {
          payment_ref: reference || `MANUAL-${Date.now()}`,
          amount_paid: amount || 0,
          exam_type: examType || 'BOTH',
          full_name: fullName,
          phone_number: phoneNumber,
          generated_by: 'ADMIN'
        }
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, token: data.token_code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/token-status', async (req, res) => {
  const { tokenCode, isActive } = req.body;
  try {
    const { error } = await supabase.from('access_tokens').update({ is_active: isActive }).eq('token_code', tokenCode);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/reset-token-device', async (req, res) => {
  const { tokenCode } = req.body;
  try {
    const { error } = await supabase.from('access_tokens').update({ device_fingerprint: null }).eq('token_code', tokenCode);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/tokens/:tokenCode', async (req, res) => {
  const { tokenCode } = req.params;
  try {
    const { error } = await supabase.from('access_tokens').delete().eq('token_code', tokenCode);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------
// GET ALL TOKENS (ADMIN DASHBOARD)
// ------------------------
app.get('/api/admin/tokens', async (req, res) => {
  try {
    const { data, error } = await supabase.from('access_tokens').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;

    const formatted = data.map(token => {
      const remainingDays = getRemainingDays(token.expires_at);
      const expiryMessage = token.expires_at
        ? remainingDays ? `${remainingDays} days remaining (Valid until ${new Date(token.expires_at).toLocaleDateString('en-GB')})` : 'Expired'
        : 'Lifetime';
      return {
        token_code: token.token_code,
        is_active: token.is_active,
        bound: !!token.device_fingerprint,
        bound_at: token.bound_at,
        expires_at: token.expires_at,
        remaining_days: remainingDays,
        exam_type: token.metadata?.exam_type || 'BOTH',
        generated_by: token.metadata?.generated_by || 'STUDENT',
        status_message: token.is_active ? expiryMessage : 'Deactivated'
      };
    });

    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------
// LOGIN WITH ACCESS CODE (STUDENT)
// ------------------------
app.post('/api/auth/login-with-token', async (req, res) => {
  const { token, deviceFingerprint, confirm_binding } = req.body;
  try {
    const { data: tokenData, error } = await supabase.from('access_tokens').select('*').eq('token_code', token).single();
    if (error || !tokenData) return res.status(401).json({ error: 'Invalid Access Code.' });
    if (!tokenData.is_active) return res.status(403).json({ error: 'This token has been deactivated.' });

    // BIND DEVICE IF NOT ALREADY
    if (!tokenData.device_fingerprint) {
      if (!confirm_binding) return res.json({ requires_binding: true });

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { error: updateError } = await supabase.from('access_tokens')
        .update({
          device_fingerprint: deviceFingerprint,
          bound_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .eq('id', tokenData.id);

      if (updateError) throw updateError;
      tokenData.device_fingerprint = deviceFingerprint;
      tokenData.bound_at = new Date().toISOString();
      tokenData.expires_at = expiresAt.toISOString();
    }

    const remainingDays = getRemainingDays(tokenData.expires_at);
    const expiryMessage = tokenData.expires_at
      ? remainingDays ? `${remainingDays} days remaining (Valid until ${new Date(tokenData.expires_at).toLocaleDateString('en-GB')})` : 'Expired'
      : 'Lifetime';

    res.json({
      success: true,
      token_code: tokenData.token_code,
      is_active: tokenData.is_active,
      bound: !!tokenData.device_fingerprint,
      bound_at: tokenData.bound_at,
      expires_at: tokenData.expires_at,
      remaining_days: remainingDays,
      exam_type: tokenData.metadata?.exam_type || 'BOTH',
      status_message: tokenData.is_active ? expiryMessage : 'Deactivated'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------
// LOGIN WITH USERNAME & PASSWORD (ADMIN/STUDENT)
// ------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('username', username).eq('role', role).single();
    if (error || !user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _, ...userInfo } = user;
    res.json(userInfo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ------------------------
// SERVE FRONTEND
// ------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('*', (req, res) => res.status(503).send(`
    <h1>Website Building...</h1>
    <p>The backend is running, but the frontend files are missing.</p>
  `));
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
