// server.js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY is not set. Set it in your environment!');
}

/* ===========================================================
   1️⃣ FORMAT PATIENT RECORD — your existing working route
=========================================================== */
app.post('/api/format-record', async (req, res) => {
  try {
    const { rawInput } = req.body || {};
    if (!rawInput || typeof rawInput !== 'string') {
      return res.status(400).json({ error: 'rawInput is required' });
    }

    const systemPrompt =
      "You are a professional medical record organizer. Your task is to extract key medical information from the provided unformatted text and structure it into a clean JSON object. If a field is not found, use 'N/A' for strings or an empty array [] for lists.";

    const userQuery = `Organize the following unformatted patient healthcare record text:\n\n---\n\n${rawInput}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            patientName: { type: 'STRING' },
            dob: { type: 'STRING' },
            diagnosis: { type: 'ARRAY', items: { type: 'STRING' } },
            provider: { type: 'STRING' },
            visitDate: { type: 'STRING' },
            summary: { type: 'STRING' },
            medications: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['patientName', 'diagnosis', 'provider', 'summary'],
        },
      },
    };

    const geminiRes = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiRes.ok) {
      const text = await geminiRes.text();
      console.error('Gemini API error:', text);
      return res
        .status(500)
        .json({ error: `Gemini API error ${geminiRes.status}` });
    }

    const json = await geminiRes.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const cleanJson = text.replace(/```json\n?|```/g, '').trim();
    const structured = JSON.parse(cleanJson);

    res.json({ data: structured });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ===========================================================
   2️⃣ GENERATE MESSY SAMPLE NOTE (NEW ROUTE)
=========================================================== */
app.post('/api/sample-note', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
    }

    const systemPrompt =
      'You generate realistic, messy, unstructured patient medical notes for testing. ' +
      'DO NOT format anything. DO NOT explain. Output only raw text.';

    const userPrompt = `
Make up a new patient encounter note with details like:
- chief complaint
- brief history
- meds / allergies
- pt name 
- physical exam
- provider name
- visit date 
- assessment / plan

Keep it VERY messy:
- inconsistent spacing
- weird punctuation
- shorthand
- partial sentences
- messy line breaks
- everything in same line 
- no paragraph or line breaks
`;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { responseMimeType: 'text/plain' },
    };

    const geminiRes = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiRes.ok) {
      const txt = await geminiRes.text();
      console.error('Sample Gemini error:', txt);
      return res.status(500).json({ error: 'Sample note API error' });
    }

    const json = await geminiRes.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```[\s\S]*?```/g, '').trim();

    res.json({ sample: clean });
  } catch (err) {
    console.error('Sample note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ===========================================================
   START SERVER
=========================================================== */
app.listen(PORT, () => {
  console.log(`✅ Gemini backend running on port ${PORT}`);
});
