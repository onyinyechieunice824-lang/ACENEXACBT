
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
// Update CORS to allow your Vercel frontend specifically, along with localhost for dev
const allowedOrigins = [
  'https://ebus-edu-consult-main-i97f.vercel.app',
  'https://ebus-edu-consult-main.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      // For now, in development/preview, we can be permissive if the exact origin varies
      // Un-comment the next line to block unknown origins
      // return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
      return callback(null, true); // Permissive fallback
    }
    return callback(null, true);
  }
}));

app.use(express.json({ limit: '50mb' })); 

// --- CONFIGURATION ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

// Validation
if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: Missing Supabase credentials in Environment Variables.");
}

// Initialize Supabase safely
// If credentials missing, create a dummy client to prevent server crash
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
    return `${prefix}-${result.slice(0, 4)}-${result.slice(4, 8)}-${result.slice(8, 12)}`;
};

// --- API ROUTES ---

// Health Check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 1. PAYMENT VERIFICATION & TOKEN GENERATION
app.post('/api/payments/verify-paystack', async (req, res) => {
    const { reference, email, fullName, phoneNumber, examType } = req.body;

    if (!reference) return res.status(400).json({ error: "Missing transaction reference." });
    if (!paystackSecretKey) return res.status(500).json({ error: "Server misconfiguration: Missing Paystack Key" });

    try {
        // IDEMPOTENCY CHECK
        const { data: existingToken } = await supabase
            .from('access_tokens')
            .select('token_code, is_active')
            .eq('metadata->>payment_ref', reference)
            .single();

        if (existingToken) {
            return res.json({ 
                success: true, 
                token: existingToken.token_code, 
                message: "Payment already verified. Retrieved existing access code." 
            });
        }

        // VERIFY WITH PAYSTACK
        const paystackUrl = `https://api.paystack.co/transaction/verify/${reference}`;
        const verifyRes = await axios.get(paystackUrl, {
            headers: { Authorization: `Bearer ${paystackSecretKey}` }
        });

        const data = verifyRes.data.data;

        if (data.status !== 'success') {
            return res.status(400).json({ error: "Payment verification failed: Transaction was not successful." });
        }

        // Expected amount check removed or adjusted because frontend now sends variable amounts.
        // We trust the payment verification from Paystack that the amount was indeed paid.
        // We could validate minimums (e.g. 150000 kobo) if needed.
        if (data.amount < 150000) {
             return res.status(400).json({ error: "Payment verification failed: Invalid amount paid." });
        }

        // GENERATE TOKEN
        const tokenCode = generateTokenCode('ACE');
        
        // Use examType passed from frontend, default to BOTH if missing (legacy support)
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
                    email: email,
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
        res.status(500).json({ error: "Server Error: Could not verify payment." });
    }
});

// ADMIN ROUTES
app.post('/api/admin/generate-token', async (req, res) => {
    const { reference, amount, examType, fullName, phoneNumber } = req.body;
    try {
        const tokenCode = generateTokenCode('ACE');
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/token-status', async (req, res) => {
    const { tokenCode, isActive } = req.body;
    if (!tokenCode) return res.status(400).json({ error: "Missing token code" });
    try {
        const { error } = await supabase.from('access_tokens').update({ is_active: isActive }).eq('token_code', tokenCode);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/reset-token-device', async (req, res) => {
    const { tokenCode } = req.body;
    if (!tokenCode) return res.status(400).json({ error: "Missing token code" });
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

app.get('/api/admin/tokens', async (req, res) => {
    try {
        const { data, error } = await supabase.from('access_tokens').select('*').order('created_at', { ascending: false }).limit(50);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// AUTH
app.post('/api/auth/login-with-token', async (req, res) => {
  const { token, deviceFingerprint, confirm_binding } = req.body;
  try {
    const { data: tokenData, error } = await supabase.from('access_tokens').select('*').eq('token_code', token).single();
    if (error || !tokenData) return res.status(401).json({ error: 'Invalid Access Token.' });
    if (!tokenData.is_active) return res.status(403).json({ error: 'This token has been deactivated.' });

    const allowedExamType = tokenData.metadata?.exam_type || 'BOTH';
    const fullName = tokenData.metadata?.full_name || 'Student';

    if (!tokenData.device_fingerprint) {
        if (!confirm_binding) return res.json({ requires_binding: true });
        const { error: updateError } = await supabase.from('access_tokens').update({ device_fingerprint: deviceFingerprint }).eq('id', tokenData.id);
        if (updateError) throw updateError;
    } else {
        if (tokenData.device_fingerprint !== deviceFingerprint) return res.status(403).json({ error: '⛔ ACCESS DENIED: Token locked to another device.' });
    }

    return res.json({ username: tokenData.token_code, role: 'student', fullName, regNumber: tokenData.token_code, isTokenLogin: true, allowedExamType });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('username', username).eq('role', role).single();
    if (error || !user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _, ...userInfo } = user;
    res.json(userInfo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// New Route: Update Credentials (Admin)
app.post('/api/auth/update-credentials', async (req, res) => {
  const { currentUsername, currentPassword, newUsername, newPassword, role } = req.body;
  try {
    // 1. Verify Current
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', currentUsername)
        .eq('role', role)
        .single();

    if (error || !user) return res.status(404).json({ error: 'Current user not found.' });
    if (user.password !== currentPassword) return res.status(401).json({ error: 'Current password is incorrect.' });

    // 2. Update to New
    const { error: updateError } = await supabase
        .from('users')
        .update({ username: newUsername, password: newPassword })
        .eq('id', user.id);

    if (updateError) throw updateError;

    res.json({ success: true, message: "Credentials updated successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New Route: Register Manual Student
app.post('/api/auth/register', async (req, res) => {
    const { fullName, regNumber } = req.body;
    try {
        const { data, error } = await supabase.from('users').insert([{
            username: regNumber,
            role: 'student',
            full_name: fullName,
            reg_number: regNumber,
            password: null, // Students don't have passwords in this mode
            allowed_exam_type: 'BOTH'
        }]).select().single();
        
        if (error) throw error;
        res.json({ success: true, user: data });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DATA
app.get('/api/users/students', async (req, res) => {
  const { data, error } = await supabase.from('users').select('*').eq('role', 'student');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// New Route: Delete User
app.delete('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const { error } = await supabase.from('users').delete().eq('username', username);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SUBJECT MANAGEMENT ROUTES
app.get('/api/subjects', async (req, res) => {
    try {
        const { data, error } = await supabase.from('subjects').select('*').order('name', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/subjects', async (req, res) => {
    const { name, category, is_compulsory } = req.body;
    if (!name || !category) return res.status(400).json({ error: "Missing required fields" });

    try {
        const { data, error } = await supabase.from('subjects').insert([{
            name,
            category,
            is_compulsory: is_compulsory || false
        }]).select().single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/subjects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/questions', async (req, res) => {
  const { data, error } = await supabase.from('questions').select('*');
  if (error) return res.status(500).json({ error: error.message });
  const mapped = data.map(q => ({
    id: q.id, subject: q.subject, examType: q.exam_type, text: q.text,
    optionA: q.option_a, optionB: q.option_b, optionC: q.option_c, optionD: q.option_d,
    correctOption: q.correct_option, explanation: q.explanation
  }));
  res.json(mapped);
});
app.post('/api/questions', async (req, res) => {
  const q = req.body;
  const dbQuestion = {
    subject: q.subject, exam_type: q.examType, text: q.text,
    option_a: q.optionA, option_b: q.optionB, option_c: q.optionC, option_d: q.optionD,
    correct_option: q.correctOption, explanation: q.explanation
  };
  const { data, error } = await supabase.from('questions').insert([dbQuestion]).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});
app.post('/api/questions/bulk', async (req, res) => {
  const questions = req.body;
  const dbQuestions = questions.map(q => ({
    subject: q.subject, exam_type: q.examType, text: q.text,
    option_a: q.optionA, option_b: q.optionB, option_c: q.optionC, option_d: q.optionD,
    correct_option: q.correctOption, explanation: q.explanation
  }));
  const { data, error } = await supabase.from('questions').insert(dbQuestions).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ count: data.length });
});
app.delete('/api/questions/:id', async (req, res) => {
  const { error } = await supabase.from('questions').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
app.delete('/api/questions/reset/all', async (req, res) => {
  const { error } = await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
app.get('/api/results/:username', async (req, res) => {
  const { data, error } = await supabase.from('results').select('*').eq('user_username', req.params.username).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const mapped = data.map(r => ({
    id: r.id, aggregateScore: r.aggregate_score, totalScore: r.total_score,
    subjectScores: r.subject_scores, timestamp: parseInt(r.timestamp), session: { examType: r.exam_type }
  }));
  res.json(mapped);
});
app.post('/api/results', async (req, res) => {
  const { username, result } = req.body;
  const dbResult = {
    user_username: username, exam_type: result.session.examType, total_score: result.totalScore,
    aggregate_score: result.aggregateScore, subject_scores: result.subjectScores, timestamp: result.timestamp
  };
  const { error } = await supabase.from('results').insert([dbResult]);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});
app.delete('/api/results/:username', async (req, res) => {
  const { error } = await supabase.from('results').delete().eq('user_username', req.params.username);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- SERVE FRONTEND (Any Environment) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

// Always attempt to serve dist if it exists
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // Helpful message if build is missing
    app.get('*', (req, res) => {
        res.status(503).send(`
            <h1>Website Building...</h1>
            <p>The backend is running, but the frontend files are missing.</p>
            <p><strong>Deployment Note:</strong> Ensure your Build Command is set to: <code>npm install && npm run build</code></p>
        `);
    });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
