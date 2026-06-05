module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemPrompt } = req.body || {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Bad request' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada. Agregá GEMINI_API_KEY en Vercel.' });

  try {
    const contents = messages
      .filter(m => m.role && m.content)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Gemini necesita que empiece con 'user' y alterne
    if (!contents.length || contents[0].role !== 'user') {
      return res.status(400).json({ error: 'El primer mensaje debe ser del usuario' });
    }

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.75 },
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini error:', resp.status, errText);
      return res.status(502).json({ error: 'Error de Gemini', detail: errText.slice(0, 200) });
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de la IA.';
    res.json({ text });
  } catch (e) {
    console.error('Chat handler error:', e);
    res.status(500).json({ error: e.message });
  }
}
