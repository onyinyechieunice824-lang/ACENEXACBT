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

// --- CORS ---
const allowedOrigins = [
  'https://acenexacbt.vercel.app',       // NEW FRONTEND
  'https://acenexacbt.onrender.com',     // NEW BACKEND
  'http://localhost:5173',               // local dev
  'http://localhost:3000'                // local dev
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow mobile apps, curl, etc.
    if (allowedOrigins.indexOf(origin) === -1) return callback(null, true); // permissive fallback
    return callback(null, true);
  }
}));

app.use(express.json({ limit: '50mb' }));

// --- SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) console.error("Missing Supabase credentials.");

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder', 
    { auth: { persistSession: false } }
);

// --- HELPERS ---
const generateAccessCode = (prefix = 'ACE') => {
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

async function createAccessCode({ createdBy = 'student', price = 0 }) {
  const code = generateAccessCode('ACE');
  const { data, error } = await supabase
      .from('access_codes')
      .insert([{ code, price, created_by: createdBy }])
      .select()
      .single();
  if (error) throw error;
  return data.code;
}

async function bindAccessCode({ code, candidateId, deviceFingerprint }) {
  const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', code)
      .single();
  if (error || !data) throw new Error('Invalid Access Code');

  if (data.is_used && data.device_fingerprint !== deviceFingerprint) {
      throw new Error('Access Code already used on another device');
  }

  const { error: updateError } = await supabase
      .from('access_codes')
      .update({
        candidate_id: candidateId,
        device_fingerprint: deviceFingerprint,
        is_used: true,
        updated_at: new Date()
      })
      .eq('id', data.id);

  if (updateError) throw updateError;
  return { success: true, message: 'Access Code bound to device' };
}

// --- ROUTES ---

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

// --------------------
// ADMIN LOGIN
// --------------------
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password.' });

  try {
    const { data: admin, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('role', 'admin')
      .single();

    if (error || !admin || admin.password !== password)
      return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, ...adminInfo } = admin;
    return res.json({ success: true, user: adminInfo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------
// USER LOGIN
// --------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const { data: user, error } = await supabase.from('users')
        .select('*')
        .eq('username', username)
        .eq('role', role)
        .single();

    if (error || !user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _, ...userInfo } = user;
    res.json(userInfo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --------------------
// REGISTER MANUAL STUDENT
// --------------------
app.post('/api/auth/register', async (req, res) => {
  const { fullName, regNumber } = req.body;
  try {
    const { data, error } = await supabase.from('users').insert([{
      username: regNumber,
      role: 'student',
      full_name: fullName,
      reg_number: regNumber,
      password: null,
      allowed_exam_type: 'BOTH'
    }]).select().single();

    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --------------------
// LOGIN WITH TOKEN (STUDENT) & BIND DEVICE
// --------------------
app.post('/api/auth/login-with-token', async (req, res) => {
  const { token, deviceFingerprint, confirm_binding, candidateId } = req.body;
  try {
    const { data: tokenData, error } = await supabase.from('access_codes').select('*').eq('code', token).single();
    if (error || !tokenData) return res.status(401).json({ error: 'Invalid Access Token.' });
    if (!tokenData.is_active) return res.status(403).json({ error: 'This token has been deactivated.' });

    if (!tokenData.device_fingerprint) {
      if (!confirm_binding) return res.json({ requires_binding: true });
      const result = await bindAccessCode({ code: token, candidateId, deviceFingerprint });
      return res.json({ success: true, message: result.message });
    } else {
      if (tokenData.device_fingerprint !== deviceFingerprint) return res.status(403).json({ error: 'Access Code locked to another device.' });
    }

    res.json({ success: true, candidateId: tokenData.candidate_id, token, message: 'Access Code valid for this device' });
  } catch (err) {
    console.error('Token login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// ADMIN ACCESS CODE MANAGEMENT
// --------------------
app.post('/api/admin/generate-code', async (req, res) => {
  const { price = 0 } = req.body;
  try {
    const code = await createAccessCode({ createdBy: 'admin', price });
    res.json({ success: true, code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/access-code/purchase', async (req, res) => {
  const { price } = req.body;
  try {
    const code = await createAccessCode({ createdBy: 'student', price });
    res.json({ success: true, code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --------------------
// SUBJECTS
// --------------------
app.get('/api/subjects', async (req, res) => {
  try {
    const { data, error } = await supabase.from('subjects').select('*').order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subjects', async (req, res) => {
  const { name, category, is_compulsory } = req.body;
  if (!name || !category) return res.status(400).json({ error: "Missing required fields" });
  try {
    const { data, error } = await supabase.from('subjects').insert([{ name, category, is_compulsory: is_compulsory || false }]).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/subjects/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --------------------
// QUESTIONS & RESULTS
// --------------------
// Keep all your previous questions/results routes here exactly as in your existing server.js

// --------------------
// SERVE FRONTEND
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('*', (req, res) => res.status(503).send(`
    <h1>Website Building...</h1>
    <p>The backend is running, but frontend files are missing.</p>
    <p>Ensure Build Command: <code>npm install && npm run build</code></p>
  `));
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
