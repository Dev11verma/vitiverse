const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

const DEFAULT_DATA = {
  stories: [],
  moods: [],
  sessions: [],
  scans: [],
  questions: [],
  appointments: []
};

const readDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_DATA, ...parsed };
  } catch (err) {
    console.error('Resetting corrupted data.json:', err.message);
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
    return { ...DEFAULT_DATA };
  }
};

const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const nowStr = (time = true) =>
  new Date().toLocaleString('en-US', time
    ? { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: '2-digit' });

app.get('/', (req, res) => res.json({ message: 'Vitiverse Node.js + JSON API is Live', health: '/api/health' }));
app.get('/api/health', (req, res) => res.json({ status: 'OK', project: 'Vitiverse', database: 'JSON Store' }));

// Stories
app.get('/api/stories', (req, res) => res.json(readDB().stories));
app.post('/api/stories', (req, res) => {
  const db = readDB();
  const { title = 'Untitled Journey', body = '', is_anonymous = true } = req.body || {};
  const item = {
    id: Date.now(),
    title,
    body,
    is_anonymous: Boolean(is_anonymous),
    author: is_anonymous ? 'Anonymous Member • Verified' : 'Community Member • Verified',
    hearts: 1,
    created_at: nowStr(true)
  };
  db.stories.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

app.post('/api/stories/:id/heart', (req, res) => {
  const db = readDB();
  const item = db.stories.find(s => s.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.hearts += 1;
  writeDB(db);
  res.json({ hearts: item.hearts });
});

// Moods
app.get('/api/moods', (req, res) => res.json(readDB().moods));
app.post('/api/moods', (req, res) => {
  const db = readDB();
  const { score = 4, note = '' } = req.body || {};
  const item = { id: Date.now(), score: Number(score), note, created_at: nowStr(true) };
  db.moods.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

// Phototherapy Sessions
app.get('/api/sessions', (req, res) => res.json(readDB().sessions));
app.post('/api/sessions', (req, res) => {
  const db = readDB();
  const nextNum = (db.sessions.length > 0 ? db.sessions[0].session_number : 14) + 1;
  const sec = 42 + (nextNum - 14) * 3;
  const item = { id: Date.now(), session_number: nextNum, duration_sec: sec, dose_mj: sec * 10, created_at: nowStr(false) };
  db.sessions.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

// Skin Diary Scans
app.get('/api/scans', (req, res) => res.json(readDB().scans));
app.post('/api/scans', (req, res) => {
  const db = readDB();
  const { case_title = 'Skin Patch Scan', status = 'ACTIVE', area_cm2 = '4.6 cm²' } = req.body || {};
  const item = { id: Date.now(), case_title, status, area_cm2, created_at: nowStr(false) };
  db.scans.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

// Community Q&A
app.get('/api/questions', (req, res) => res.json(readDB().questions));
app.post('/api/questions', (req, res) => {
  const db = readDB();
  const item = {
    id: Date.now(),
    question_text: req.body?.question_text || '',
    answer_text: 'Awaiting community & dermatologist replies...',
    created_at: nowStr(false)
  };
  db.questions.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

// Specialist Appointments
app.get('/api/appointments', (req, res) => res.json(readDB().appointments));
app.post('/api/appointments', (req, res) => {
  const db = readDB();
  const item = {
    id: Date.now(),
    doctor_name: req.body?.doctor_name || 'Specialist',
    patient_persona: req.body?.patient_persona || 'Adult / Self',
    created_at: nowStr(true)
  };
  db.appointments.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

// VitiBuddy AI Chat (True Multilingual Open-Ended Gemini AI + Auto-Discovery)
app.post('/api/chat', async (req, res) => {
  const msg = (req.body?.message || '').trim();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return res.json({ reply: 'Please add GEMINI_API_KEY in Render Environment settings to activate live AI.', source: 'no-key' });
  }

  const systemPrompt = `You are VitiBuddy, an intelligent, warm, empathetic AI companion on the Vitiverse platform.
Rules:
1. Respond naturally to ANYTHING the user says or asks—whether it is about Vitiligo, skincare, confidence, daily life, general knowledge, or casual conversation.
2. ALWAYS reply in the exact same language and script/style the user used (e.g., if they write in English, reply in English; if Hindi, reply in Hindi; if Hinglish, reply in Hinglish; if Spanish/French/etc., reply in that language).
3. Keep answers helpful, conversational, and concise (2-4 sentences unless they ask for more detail).
4. Never give formal medical prescriptions; suggest consulting a dermatologist for medical treatment decisions.

User message: ${msg}`;

  try {
    let candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash-lite', 'gemma-3-27b-it'];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => m.name.replace('models/', ''))
          .filter(name => !name.includes('embedding') && !name.includes('vision') && !name.includes('tts') && !name.includes('image'));
        if (available.length > 0) {
          const prioritized = [
            ...available.filter(n => n.includes('3.8-flash')),
            ...available.filter(n => n.includes('flash') && !n.includes('3.8')),
            ...available.filter(n => n.includes('gemma-3-27b')),
            ...available.filter(n => n.includes('pro'))
          ];
          candidateModels = [...new Set([...prioritized, ...available])].slice(0, 6);
        }
      } else {
        const errData = await listRes.json();
        console.error('Model list error:', listRes.status, errData?.error?.message || '');
      }
    } catch (e) {
      console.error('Model discovery skipped:', e.message);
    }

    for (const model of candidateModels) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const apiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }]
          })
        });
        clearTimeout(timer);
        const data = await apiRes.json();
        const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (apiRes.ok && replyText) {
          return res.json({ reply: replyText.trim(), model });
        }
        console.error(`Model ${model} (${apiRes.status}):`, data?.error?.message || 'failed');
      } catch (err) {
        clearTimeout(timer);
        console.error(`Model ${model} error:`, err.message);
      }
    }
  } catch (fatal) {
    console.error('VitiBuddy fatal error:', fatal.message);
  }

  res.json({
    reply: 'Gemini is experiencing a temporary spike right now—please send your message again in a few seconds! 💛',
    source: 'error'
  });
});

app.listen(PORT, () => console.log(`Vitiverse Node server live on port ${PORT}`));