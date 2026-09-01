// Proxy a Gemini. Requiere sesión válida de Supabase: sin login no se
// puede usar (antes cualquiera con curl gastaba nuestra cuota de Gemini).
const ALLOWED_ORIGINS = [
  'https://studyhub.com.ar',
  'https://www.studyhub.com.ar',
  'https://study-hub-theta-one.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

/* Límites de entrada — cortan el abuso por payloads gigantes */
const MAX_MESSAGES = 40;
const MAX_CHARS = 24000;
const MAX_SYSTEM_CHARS = 12000;

/* Rate limit por usuario, contado en la base (compartido entre todas las
   instancias serverless). Si la base no responde caemos al contador en
   memoria — peor, pero mejor que quedarnos sin límite. */
const RATE_MAX = 30;
const RATE_WINDOW_MIN = 10;
const hits = new Map();

function rateLimitedInMemory(userId) {
  const now = Date.now();
  const prev = (hits.get(userId) || []).filter(t => now - t < RATE_WINDOW_MIN * 60 * 1000);
  if (prev.length >= RATE_MAX) return true;
  prev.push(now);
  hits.set(userId, prev);
  if (hits.size > 5000) hits.clear();
  return false;
}

async function rateLimited(userId) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return rateLimitedInMemory(userId);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/check_ai_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_max: RATE_MAX,
        p_window_minutes: RATE_WINDOW_MIN,
      }),
    });
    if (!r.ok) return rateLimitedInMemory(userId);
    const permitido = await r.json();
    return permitido === false;
  } catch {
    return rateLimitedInMemory(userId);
  }
}

/* Valida el token contra Supabase. Devuelve el user id o null. */
async function getUserId(token) {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_KEY;
  if (!url || !anon || !token) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id || null;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);

  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // El Origin se puede falsificar fuera del navegador, por eso lo que
  // realmente protege es el token de abajo. Esto solo frena al navegador.
  if (origin && !allowed) return res.status(403).json({ error: 'Origen no autorizado' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const userId = await getUserId(token);
  if (!userId) return res.status(401).json({ error: 'Necesitás iniciar sesión para usar la IA.' });

  if (await rateLimited(userId)) {
    return res.status(429).json({ error: 'Estás yendo muy rápido. Esperá unos minutos.' });
  }

  const { messages, systemPrompt } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Bad request' });
  if (messages.length > MAX_MESSAGES) return res.status(413).json({ error: 'Conversación demasiado larga.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada.' });

  try {
    const contents = messages
      .filter(m => m && typeof m.content === 'string' && m.role)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const total = contents.reduce((n, c) => n + c.parts[0].text.length, 0);
    if (total > MAX_CHARS) return res.status(413).json({ error: 'Mensaje demasiado largo.' });

    if (!contents.length || contents[0].role !== 'user') {
      return res.status(400).json({ error: 'El primer mensaje debe ser del usuario' });
    }

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.75 },
    };

    if (typeof systemPrompt === 'string' && systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt.slice(0, MAX_SYSTEM_CHARS) }] };
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!resp.ok) {
      // El detalle solo va al log — puede traer info interna de Google.
      console.error('Gemini error:', resp.status, (await resp.text()).slice(0, 500));
      return res.status(502).json({ error: 'La IA no está disponible en este momento.' });
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de la IA.';
    res.json({ text });
  } catch (e) {
    console.error('Chat handler error:', e);
    res.status(500).json({ error: 'Error interno.' });
  }
}
