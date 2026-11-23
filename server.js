const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

const DEFAULT_DATA = { stories: [], moods: [], sessions: [], scans: [], questions: [], appointments: [] };
const readDB = () => fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : DEFAULT_DATA;
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const nowStr = (time = true) => new Date().toLocaleString('en-US', time ? { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' } : { month: 'short', day: '2-digit' });

app.get('/', (req, res) => res.json({ message: 'Vitiverse Node.js + JSON API is Live', health: '/api/health' }));
app.get('/api/health', (req, res) => res.json({ status: 'OK', project: 'Vitiverse', database: 'JSON Store' }));

app.get('/api/stories', (req, res) => res.json(readDB().stories));
app.post('/api/stories', (req, res) => {
  const db = readDB();
  const { title = 'Untitled Journey', body = '', is_anonymous = true } = req.body || {};
  const item = { id: Date.now(), title, body, is_anonymous: Boolean(is_anonymous), author: is_anonymous ? 'Anonymous Member • Verified' : 'Community Member • Verified', hearts: 1, created_at: nowStr(true) };
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

app.post('/api/moods', (req, res) => {
  const db = readDB();
  const { score = 4, note = '' } = req.body || {};
  const item = { id: Date.now(), score: Number(score), note, created_at: nowStr(true) };
  db.moods.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

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

app.post('/api/scans', (req, res) => {
  const db = readDB();
  const { case_title = 'Skin Patch Scan', status = 'ACTIVE', area_cm2 = '4.6 cm²' } = req.body || {};
  const item = { id: Date.now(), case_title, status, area_cm2, created_at: nowStr(false) };
  db.scans.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

app.get('/api/questions', (req, res) => res.json(readDB().questions));
app.post('/api/questions', (req, res) => {
  const db = readDB();
  const item = { id: Date.now(), question_text: req.body?.question_text || '', answer_text: 'Awaiting community & dermatologist replies...', created_at: nowStr(false) };
  db.questions.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

app.post('/api/appointments', (req, res) => {
  const db = readDB();
  const item = { id: Date.now(), doctor_name: req.body?.doctor_name || 'Specialist', patient_persona: req.body?.patient_persona || 'Adult / Self', created_at: nowStr(true) };
  db.appointments.unshift(item);
  writeDB(db);
  res.status(201).json(item);
});

app.post('/api/chat', async (req, res) => {
  const msg = (req.body?.message || '').trim();
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `You are VitiBuddy, an empathetic Vitiligo support companion. Reply in 2-3 warm sentences in the user's language (English/Hindi). Never diagnose.\n\nUser: ${msg}` });
      return res.json({ reply: r.text });
    } catch {}
  }
  res.json({ reply: 'You are so much more than your skin. Vitiligo is autoimmune—never contagious—and consistent care makes all the difference. 💛' });
});

app.listen(PORT, () => console.log(`Vitiverse Node server live on port ${PORT}`));
