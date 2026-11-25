const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'data.json');
const MONGODB_URI = (process.env.MONGODB_URI || '').trim();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Dual Storage Layer (MongoDB Atlas Primary + Local JSON Fallback) ---
let mongoDb = null;

async function connectMongo(retries = 3) {
  if (!MONGODB_URI) {
    console.log('MONGODB_URI not set—running with local data.json storage.');
    return;
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        tls: true
      });
      await client.connect();
      mongoDb = client.db('vitiverse');
      console.log('Connected to MongoDB Atlas (vitiverse database) ✅');
      return;
    } catch (err) {
      console.error(`MongoDB attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) await new Promise(r => setTimeout(r, 2500));
    }
  }
  console.error('MongoDB unavailable after retries, falling back to data.json');
}

const DEFAULT_DATA = {
  stories: [],
  moods: [],
  sessions: [],
  scans: [],
  questions: [],
  appointments: []
};

const readLocalDB = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8').replace(/^\uFEFF/, '').trim();
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_DATA, ...parsed };
  } catch {
    return { ...DEFAULT_DATA };
  }
};

const writeLocalDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

async function getItems(collectionName) {
  if (mongoDb) {
    return await mongoDb.collection(collectionName).find({}, { projection: { _id: 0 } }).sort({ id: -1 }).toArray();
  }
  return readLocalDB()[collectionName] || [];
}

async function addItem(collectionName, item) {
  if (mongoDb) {
    await mongoDb.collection(collectionName).insertOne({ ...item });
    return item;
  }
  const db = readLocalDB();
  db[collectionName].unshift(item);
  writeLocalDB(db);
  return item;
}

const nowStr = (time = true) =>
  new Date().toLocaleString('en-US', time
    ? { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: '2-digit' });

app.get('/', (req, res) => res.json({
  message: 'Vitiverse Node.js API is Live',
  database: mongoDb ? 'MongoDB Atlas' : 'Local JSON Store',
  health: '/api/health'
}));

app.get('/api/health', (req, res) => res.json({
  status: 'OK',
  project: 'Vitiverse',
  database: mongoDb ? 'MongoDB Atlas' : 'Local JSON Store'
}));

// Stories
app.get('/api/stories', async (req, res) => res.json(await getItems('stories')));
app.post('/api/stories', async (req, res) => {
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
  await addItem('stories', item);
  res.status(201).json(item);
});

app.post('/api/stories/:id/heart', async (req, res) => {
  const storyId = Number(req.params.id);
  if (mongoDb) {
    const col = mongoDb.collection('stories');
    const updated = await col.findOneAndUpdate(
      { id: storyId },
      { $inc: { hearts: 1 } },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json({ hearts: updated.hearts });
  }
  const db = readLocalDB();
  const item = db.stories.find(s => s.id === storyId);
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.hearts += 1;
  writeLocalDB(db);
  res.json({ hearts: item.hearts });
});

// Moods
app.get('/api/moods', async (req, res) => res.json(await getItems('moods')));
app.post('/api/moods', async (req, res) => {
  const { score = 4, note = '' } = req.body || {};
  const item = { id: Date.now(), score: Number(score), note, created_at: nowStr(true) };
  await addItem('moods', item);
  res.status(201).json(item);
});

// Phototherapy Sessions
app.get('/api/sessions', async (req, res) => res.json(await getItems('sessions')));
app.post('/api/sessions', async (req, res) => {
  const existing = await getItems('sessions');
  const nextNum = (existing.length > 0 ? existing[0].session_number : 14) + 1;
  const sec = 42 + (nextNum - 14) * 3;
  const item = { id: Date.now(), session_number: nextNum, duration_sec: sec, dose_mj: sec * 10, created_at: nowStr(false) };
  await addItem('sessions', item);
  res.status(201).json(item);
});

// Skin Diary Scans
app.get('/api/scans', async (req, res) => res.json(await getItems('scans')));
app.post('/api/scans', async (req, res) => {
  const { case_title = 'Skin Patch Scan', status = 'ACTIVE', area_cm2 = '4.6 cm²' } = req.body || {};
  const item = { id: Date.now(), case_title, status, area_cm2, created_at: nowStr(false) };
  await addItem('scans', item);
  res.status(201).json(item);
});

// Community Q&A
app.get('/api/questions', async (req, res) => res.json(await getItems('questions')));
app.post('/api/questions', async (req, res) => {
  const item = {
    id: Date.now(),
    question_text: req.body?.question_text || '',
    answer_text: 'Awaiting community & dermatologist replies...',
    created_at: nowStr(false)
  };
  await addItem('questions', item);
  res.status(201).json(item);
});

// Specialist Appointments
app.get('/api/appointments', async (req, res) => res.json(await getItems('appointments')));
app.post('/api/appointments', async (req, res) => {
  const item = {
    id: Date.now(),
    doctor_name: req.body?.doctor_name || 'Specialist',
    patient_persona: req.body?.patient_persona || 'Adult / Self',
    created_at: nowStr(true)
  };
  await addItem('appointments', item);
  res.status(201).json(item);
});

// Module 01: Real Gemini Vision Skin Patch Analysis (Strict Skin Gate + Native JSON Mode)
app.post('/api/analyze-patch', async (req, res) => {
  const { imageBase64 = '', mimeType = 'image/jpeg', caseTitle = 'Uploaded Patch Scan' } = req.body || {};
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!imageBase64) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  if (!apiKey) {
    return res.status(500).json({
      is_skin: false,
      case_title: caseTitle,
      status: 'API KEY MISSING',
      confidence: '0%',
      area_cm2: '0.0 cm²',
      border_index: 'N/A',
      repigmentation: 'N/A',
      observations: 'GEMINI_API_KEY is not configured on Render.',
      care_tip: 'Add GEMINI_API_KEY in Render Environment settings.'
    });
  }

  const visionPrompt = `You are a strict dermatological image-screening engine for the Vitiverse platform.
STEP 1 (STRICT VALIDATION): Inspect whether this image is a genuine photograph of real human skin (showing real skin texture, pores, hair follicles, or epidermis).
- If it is artwork, a comic character (e.g., Doctor Doom), cartoon, anime, 3D render, animal, object, landscape, food, text/screenshot, or too blurry/dark to see skin texture, you MUST set "is_skin": false.
- Only set "is_skin": true if real human skin is clearly visible.

STEP 2 (PIGMENT ASSESSMENT):
- If "is_skin" is false: set "status" to "INVALID IMAGE (NOT HUMAN SKIN)", "confidence" to "0%", "area_cm2" to "0.0 cm²", "border_index" to "N/A (Non-Skin Input)", "repigmentation" to "N/A", "observations" to a direct 1-2 sentence description of what is actually shown in the image and why it cannot be analyzed as skin, and "care_tip" to "Upload a clear, well-lit close-up photo of real human skin to run pigment tracking."
- If "is_skin" is true: evaluate visible depigmentation/hypopigmentation vs. uniform skin tone. Set "status" to "ACTIVE PATCH" (if feathered/ill-defined borders), "STABLE PATCH" (if sharp, well-demarcated borders), "REPIGMENTING" (if perifollicular pigment dots are visible inside the patch), or "NO DEPIGMENTATION DETECTED" (if uniform healthy skin). Provide realistic "confidence" (e.g. "93.5%"), "area_cm2" (e.g. "3.2 cm²" or "0.0 cm²" if uniform skin), "border_index", "repigmentation", 2 concise educational sentences in "observations", and 1 practical SPF/skincare tip in "care_tip".

Return ONLY a JSON object with keys: is_skin, status, confidence, area_cm2, border_index, repigmentation, observations, care_tip.`;

  let candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash-lite'];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      const available = (listData.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(name => name.includes('gemini') && !name.includes('embedding') && !name.includes('tts'));
      if (available.length > 0) {
        const prioritized = [
          ...available.filter(n => n.includes('3.8-flash')),
          ...available.filter(n => n.includes('2.5-flash') && !n.includes('lite')),
          ...available.filter(n => n.includes('flash'))
        ];
        candidateModels = [...new Set([...prioritized, ...available])].slice(0, 5);
      }
    }
  } catch {}

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: visionPrompt },
              { inlineData: { mimeType, data: imageBase64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });
      clearTimeout(timer);
      const data = await apiRes.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = rawText.replace(/```json|```/gi, '').trim();
      if (apiRes.ok && cleaned) {
        const parsed = JSON.parse(cleaned);
        const isSkin = Boolean(parsed.is_skin);
        return res.json({
          is_skin: isSkin,
          case_title: caseTitle,
          status: parsed.status || (isSkin ? 'ACTIVE PATCH' : 'INVALID IMAGE (NOT HUMAN SKIN)'),
          confidence: parsed.confidence || (isSkin ? '92.0%' : '0%'),
          area_cm2: parsed.area_cm2 || '0.0 cm²',
          border_index: parsed.border_index || 'N/A',
          repigmentation: parsed.repigmentation || 'N/A',
          observations: parsed.observations || 'Visual screening complete.',
          care_tip: parsed.care_tip || 'Apply SPF 50+ sunscreen daily and consult a dermatologist.',
          model
        });
      }
    } catch (err) {
      clearTimeout(timer);
      console.error(`Vision ${model} error:`, err.message);
    }
  }

  res.status(502).json({
    is_skin: false,
    case_title: caseTitle,
    status: 'VISION SERVICE RETRYING',
    confidence: '0%',
    area_cm2: '0.0 cm²',
    border_index: 'N/A',
    repigmentation: 'N/A',
    observations: 'The Vision server took too long to wake up. Please re-select your image once to run the live scan.',
    care_tip: 'Tip: Keep the server warm or retry within a few seconds.'
  });
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
2. ALWAYS reply in the exact same language and script/style the user used (e.g., if they write in English, reply in English; if Hindi, reply in Hindi; if Hinglish, reply in Hinglish; if Punjabi/Spanish/etc., reply in that language).
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
      }
    } catch {}

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
      } catch {
        clearTimeout(timer);
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

connectMongo().then(() => {
  app.listen(PORT, () => console.log(`Vitiverse Node server live on port ${PORT}`));
});