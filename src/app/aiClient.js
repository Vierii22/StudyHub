import { supabase } from '../supabase.js';

/* ============================================================
   Llamada a /api/chat CON el token de sesión. El backend rechaza
   cualquier pedido sin token válido (antes cualquiera podía usar
   nuestra cuota de Gemini desde afuera).
   Vive acá y no en aiPrompt.js para que el prompt quede sin
   dependencias del navegador y se pueda testear en Node.
   ============================================================ */
export async function askAI({ systemPrompt, messages }) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('sin-sesion');

  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ systemPrompt, messages }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || 'error');
  return json;
}
