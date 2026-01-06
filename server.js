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

// Middleware
const allowedOrigins = [
  'https://acenexacbt.vercel.app',
  'https://acenexacbt.onrender.com',
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

// --- CONFIG ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) console.error("Missing Supabase credentials.");

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder',
  { auth: { persistSession: false } }
);

// --- HELPER FUNCTIONS ---
const generateTokenCode = (prefix = 'ACE') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 12;
  const randomBytes = crypto.randomBytes(length);

  let result = '';
  for (let i = 0; i < length; i++) {
    const index = randomBytes[i] % chars.length;
    result += chars[index];
  }
  return `${prefix}-${result.slice(0,4)}-${result.slice(4,8)}-${result.slice(8,12)}`;
};

const getRemainingDays = (expires_at) => {
  if (!expires_at) return null;
  const expiryDate = new Date(expires_at);
  const now = new Date();
  const diffTime = expiryDate - now;
  return Math.ceil(diffTime / (1000*60*60*24));
};

// --- API ROUTES ---
app.get('/health', (req, res) => res.status(200).send('OK'));

// PAYMENT VERIFICATION & TOKEN GENERATION
app.post('/api/payments/verify-paystack', async (req, res) => {
  const { reference, email, fullName, phoneNumber, examType } = req.body;
  if (!reference) return res.status(400).json({ error: "Missing transaction reference." });
  if (!paystackSecretKey) return res.status(500).json({ error: "Missing Paystack Key" });

  try {
    const { data: existingToken } = await supabase
      .from('access_tokens')
      .select('token_code, is_active, expires_at')
      .eq('metadata->>payment_ref', reference)
      .single();

    if (existingToken) return res.json({
      success: true,
      token: existingToken.token_code,
      message: "Payment already verified.",
      expiresAt: existingToken.expires_at
    });

    const paystackUrl = `https://api.paystack.co/transaction/verify/${reference}`;
    const verifyRes = await axios.get(paystackUrl, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` }
    });

    const data = verifyRes.data.data;
    if (data.status !== 'success') return res.status(400).json({ error: "Payment not successful" });
    if (data.amount < 150000) return res.status(400).json({ error: "Invalid amount paid." });

    const tokenCode = generateTokenCode('ACE');
    const finalExamType = examType || 'BOTH';
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1-year expiry

    const { data: dbData, error } = await supabase
      .from('access_tokens')
      .insert([{
        token_code: tokenCode,
        is_active: true,
        device_fingerprint: null,
        expires_at: expiresAt.toISOString(),
        metadata: {
          payment_ref: reference,
          amount_paid: data.amount / 100,
          exam_type: finalExamType,
          full_name: fullName,
          phone_number: phoneNumber,
          email: email,
          paystack_id: data.id,
          verified_at: new Date().toISOString()
        }
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, token: dbData.token_code, expiresAt: dbData.expires_at });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Server Error: Could not verify payment." });
  }
});

// ADMIN GENERATE TOKEN
app.post('/api/admin/generate-token', async (req, res) => {
  const { reference, amount, examType, fullName, phoneNumber } = req.body;
  try {
    const tokenCode = generateTokenCode('ACE');
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { data, error } = await supabase
      .from('access_tokens')
      .insert([{
        token_code: tokenCode,
        is_active: true,
        device_fingerprint: null,
        expires_at: expiresAt.toISOString(),
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
    res.json({ success: true, token: data.token_code, expiresAt: data.expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN WITH TOKEN
app.post('/api/auth/login-with-token', async (req, res) => {
  const { token, deviceFingerprint, confirm_binding } = req.body;
  try {
    const { data: tokenData, error } = await supabase
      .from('access_tokens')
      .select('*')
      .eq('token_code', token)
      .single();
    if (error || !tokenData) return res.status(401).json({ error: 'Invalid Access Token.' });
    if (!tokenData.is_active) return res.status(403).json({ error: 'Token deactivated.' });

    // Auto expiry check
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
    if (expiresAt && new Date() > expiresAt) {
      return res.status(403).json({ error: 'Access Code Expired.' });
    }

    if (!tokenData.device_fingerprint) {
      if (!confirm_binding) return res.json({ requires_binding: true });

      const { error: updateError } = await supabase
        .from('access_tokens')
        .update({ device_fingerprint: deviceFingerprint })
        .eq('id', tokenData.id);
      if (updateError) throw updateError;

      const { data: updatedToken } = await supabase
        .from('access_tokens')
        .select('*')
        .eq('id', tokenData.id)
        .single();

      return res.json({
        username: tokenData.token_code,
        role: 'student',
        fullName: tokenData.metadata?.full_name || 'Student',
        regNumber: tokenData.token_code,
        isTokenLogin: true,
        allowedExamType: tokenData.metadata?.exam_type || 'BOTH',
        message: `Access code bound successfully! Valid until ${new Date(updatedToken.expires_at).toLocaleDateString()}`,
        expiresAt: updatedToken.expires_at
      });
    } else if (tokenData.device_fingerprint !== deviceFingerprint) {
      return res.status(403).json({ error: 'ACCESS DENIED: Code locked to another device.' });
    }

    return res.json({
      username: tokenData.token_code,
      role: 'student',
      fullName: tokenData.metadata?.full_name || 'Student',
      regNumber: tokenData.token_code,
      isTokenLogin: true,
      allowedExamType: tokenData.metadata?.exam_type || 'BOTH',
      remainingDays: getRemainingDays(tokenData.expires_at),
      expiresAt: tokenData.expires_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- FRONTEND SERVING ---
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
