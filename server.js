app.post('/api/sample-note', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on backend.' });
    }

    const systemPrompt =
      'You generate realistic, messy, unstructured patient medical notes for testing. ' +
      'Do NOT format anything as JSON or Markdown. Do NOT add explanations. ' +
      'Output only the raw note text, as a single block of text, with line breaks, ' +
      'shorthand, abbreviations, and inconsistent formatting like rushed clinician notes.';

    const userPrompt = `
Make up a new patient encounter note with details like:

- chief complaint
- brief history
- meds
- allergies
- physical exam
- provider name
- visit date 
- assessment / plan

But keep it VERY UNFORMATTED:
- inconsistent spacing
- weird punctuation
- shorthand
- partial sentences
- messy line breaks

Again: DO NOT wrap in code fences. DO NOT use Markdown headings. Just raw text.
`;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'text/plain',
      },
    };

    const geminiRes = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiRes.ok) {
      const text = await geminiRes.text();
      console.error('Gemini sample API error:', text);
      return res
        .status(500)
        .json({ error: `Gemini sample API error ${geminiRes.status}` });
    }

    const json = await geminiRes.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return res
        .status(500)
        .json({ error: 'Gemini returned an empty sample note.' });
    }

    const clean = text.replace(/```[\s\S]*?```/g, '').trim();
    res.json({ sample: clean });
  } catch (err) {
    console.error('Sample note proxy error:', err);
    res.status(500).json({ error: 'Internal server error (sample-note)' });
  }
});
