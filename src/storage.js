import { supabase } from './supabase.js';

/* ============================================================
   DOMAIN MAP — cada clave agrupa campos relacionados.
   Solo se sube a Supabase el dominio que realmente cambió.
   ============================================================ */
export const DOMAIN_MAP = {
  sh_profile:  ['profile', 'streak'],
  sh_tasks:    ['tasks', 'taskCalendarMap', 'missions'],
  sh_subjects: ['subjects'],
  sh_calendar: ['events'],
  sh_diary:    ['journal', 'journalDraft', 'morning'],
  sh_finance:  ['finance'],
  sh_settings: ['settings'],
  sh_pomoLog:  ['pomoLog'],
  sh_space:    ['space'],
  sh_kitchen:  ['kitchen', 'shopping'],
  sh_home:     ['home', 'ocio'],
  sh_dash:     ['dashWidgets', 'dashSpans', 'dashNote', 'widgetConfig', 'bgImages'],
};

/* Todas las claves de dominio */
const DOMAIN_KEYS = Object.keys(DOMAIN_MAP);

/* Qué dominio contiene cada campo top-level del blob */
const FIELD_TO_DOMAIN = {};
for (const [dk, fields] of Object.entries(DOMAIN_MAP)) {
  for (const f of fields) FIELD_TO_DOMAIN[f] = dk;
}

/* ── internals ───────────────────────────────────────────── */
let _currentUserId = null;
let _channel = null;

async function _getUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch { return null; }
}

/* Extrae los campos de un dominio del blob completo */
function _extractDomain(blob, domainKey) {
  const fields = DOMAIN_MAP[domainKey];
  if (!fields) return null;
  const out = {};
  for (const f of fields) if (f in blob) out[f] = blob[f];
  return out;
}

/* Sube una clave de dominio a Supabase */
async function _supabaseSetDomain(userId, domainKey, domainData) {
  const payload = typeof domainData === 'string' ? domainData : JSON.stringify(domainData);
  let parsed;
  try { parsed = JSON.parse(payload); } catch { parsed = domainData; }
  await supabase.from('app_data').upsert(
    { user_id: userId, key: domainKey, value: parsed, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' }
  );
}

/* Sube varios dominios del blob a Supabase en paralelo */
async function _persistDomains(userId, blob, domainKeys) {
  if (!userId || !blob) return;
  await Promise.all(
    domainKeys.map(dk => {
      const domainData = _extractDomain(blob, dk);
      if (domainData) return _supabaseSetDomain(userId, dk, domainData);
    })
  );
}

async function _supabaseRemove(userId, key) {
  if (!userId) return;
  await supabase.from('app_data').delete().match({ user_id: userId, key });
}

/* ── realtime ────────────────────────────────────────────── */
function _stopRealtime() {
  if (_channel) { supabase.removeChannel(_channel); _channel = null; }
}

function _startRealtime(userId) {
  _stopRealtime();
  _channel = supabase
    .channel('app_data_sync_' + userId)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'app_data',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const { key, value } = payload.new;
        window.dispatchEvent(new CustomEvent('sh:storage-sync', { detail: { key, value } }));
      }
    })
    .subscribe();
}

/* ── initial sync & migration ────────────────────────────── */
async function _initialSync() {
  const userId = await _getUserId();
  if (!userId) return;
  _currentUserId = userId;

  const { data, error } = await supabase
    .from('app_data')
    .select('key, value, updated_at')
    .eq('user_id', userId);

  if (!error && data) {
    const rows = {};
    for (const row of data) rows[row.key] = row;

    const hasDomainKeys = DOMAIN_KEYS.some(dk => rows[dk]);
    const hasOldBlob    = !!rows['sh_data'];

    if (hasOldBlob && !hasDomainKeys) {
      /* ── MIGRACIÓN: sh_data → claves de dominio ── */
      const blobValue = rows['sh_data'].value;
      const blob = typeof blobValue === 'string' ? JSON.parse(blobValue) : blobValue;

      /* Escribir localStorage con el blob completo para que la app arranque rápido */
      try { localStorage.setItem('sh_data', JSON.stringify(blob)); } catch {}

      /* Subir cada dominio a Supabase */
      await _persistDomains(userId, blob, DOMAIN_KEYS);

      /* Borrar el blob viejo */
      await _supabaseRemove(userId, 'sh_data');
      try { localStorage.removeItem('sh_data'); } catch {}

    } else if (hasDomainKeys) {
      /* ── Merge de dominios al localStorage ── */
      let localBlob = {};
      try {
        const raw = localStorage.getItem('sh_data');
        if (raw) localBlob = JSON.parse(raw);
      } catch {}

      for (const dk of DOMAIN_KEYS) {
        if (!rows[dk]) continue;
        const val = rows[dk].value;
        const domainData = typeof val === 'string' ? JSON.parse(val) : val;
        const remoteTs = rows[dk].updated_at;

        /* Solo pisamos localStorage si el remoto es más nuevo */
        const localDomainTs = localStorage.getItem('sh_ts_' + dk);
        if (remoteTs && localDomainTs && localDomainTs > remoteTs) continue;

        Object.assign(localBlob, domainData);
        try { localStorage.setItem('sh_ts_' + dk, remoteTs || new Date().toISOString()); } catch {}
      }

      try { localStorage.setItem('sh_data', JSON.stringify(localBlob)); } catch {}

    } else {
      /* Usuario nuevo o con datos solo locales — subir si tiene perfil */
      const localRaw = localStorage.getItem('sh_data');
      if (localRaw) {
        try {
          const blob = JSON.parse(localRaw);
          if (blob?.profile?.name) {
            await _persistDomains(userId, blob, DOMAIN_KEYS);
          }
        } catch {}
      }
    }
  }

  _startRealtime(userId);
  _startPolling(userId);
  window.dispatchEvent(new CustomEvent('sh:user-synced'));
}

/* ── polling periódico ───────────────────────────────────── */
let _pollTimer  = null;
let _onFocus    = null;

function _startPolling(userId) {
  if (_pollTimer) clearInterval(_pollTimer);

  const fetchLatest = async () => {
    const { data, error } = await supabase
      .from('app_data')
      .select('key, value, updated_at')
      .eq('user_id', userId)
      .in('key', DOMAIN_KEYS);

    if (error || !data) return;

    for (const row of data) {
      const ts = localStorage.getItem('sh_ts_' + row.key);
      if (ts && ts >= row.updated_at) continue; /* local es más nuevo o igual */

      window.dispatchEvent(new CustomEvent('sh:storage-sync', {
        detail: { key: row.key, value: row.value },
      }));
    }
  };

  _pollTimer = setInterval(fetchLatest, 60_000);

  if (_onFocus) window.removeEventListener('focus', _onFocus);
  _onFocus = fetchLatest;
  window.addEventListener('focus', _onFocus);
}

/* ── auth state ──────────────────────────────────────────── */
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    const newId = session?.user?.id;
    if (newId && newId !== _currentUserId) _initialSync();
  } else if (event === 'SIGNED_OUT') {
    _currentUserId = null;
    _stopRealtime();
    if (_pollTimer)  { clearInterval(_pollTimer); _pollTimer = null; }
    if (_onFocus)    { window.removeEventListener('focus', _onFocus); _onFocus = null; }
    /* Limpiar timestamps de dominio */
    for (const dk of DOMAIN_KEYS) {
      try { localStorage.removeItem('sh_ts_' + dk); } catch {}
    }
  }
});

_initialSync();

/* ============================================================
   COLA DE ESCRITURAS OFFLINE
   Si navigator.onLine === false, las escrituras se encolan en
   localStorage ('sh_offline_queue'). Al recuperar conexión se
   procesan en orden y se borra la cola.
   ============================================================ */
const QUEUE_KEY = 'sh_offline_queue';

function _readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function _saveQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}

async function _flushQueue(userId) {
  const q = _readQueue();
  if (q.length === 0) return;
  const failed = [];
  for (const item of q) {
    try {
      const { error } = await supabase.from('app_data').upsert(
        { user_id: userId, key: item.key, value: item.value, updated_at: item.ts },
        { onConflict: 'user_id,key' }
      );
      if (error) failed.push(item);
    } catch { failed.push(item); }
  }
  _saveQueue(failed);
  window.dispatchEvent(new CustomEvent('sh:sync-status', { detail: failed.length === 0 ? 'ok' : 'error' }));
}

/* Registrar listener al recuperar conexión */
window.addEventListener('online', async () => {
  window.dispatchEvent(new CustomEvent('sh:sync-status', { detail: 'syncing' }));
  const userId = _currentUserId || await _getUserId();
  if (userId) await _flushQueue(userId);
});
window.addEventListener('offline', () => {
  window.dispatchEvent(new CustomEvent('sh:sync-status', { detail: 'offline' }));
});

/* ============================================================
   SupabaseStorage — API pública usada por store.jsx
   ============================================================ */
export const SupabaseStorage = {
  isElectron: false,
  isReady: () => true,
  onReady: (cb) => cb(),

  getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },

  /* Llamado por store.jsx con la clave del dominio y el JSON del dominio */
  async setItem(key, value) {
    try { localStorage.setItem(key === 'sh_data' ? 'sh_data' : key, value); } catch {}
    const userId = _currentUserId || await _getUserId();
    if (!userId) return;

    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    const ts = new Date().toISOString();
    try { localStorage.setItem('sh_ts_' + key, ts); } catch {}

    if (!navigator.onLine) {
      /* Offline: encolar escritura para reintentar al reconectar */
      const q = _readQueue();
      const idx = q.findIndex(i => i.key === key);
      const item = { key, value: parsed, ts };
      if (idx >= 0) q[idx] = item; else q.push(item);
      _saveQueue(q);
      window.dispatchEvent(new CustomEvent('sh:sync-status', { detail: 'offline' }));
      return;
    }

    supabase.from('app_data').upsert(
      { user_id: userId, key, value: parsed, updated_at: ts },
      { onConflict: 'user_id,key' }
    ).then(({ error }) => {
      if (!error) window.dispatchEvent(new CustomEvent('sh:sync-status', { detail: 'ok' }));
    }).catch(() => {
      /* Si falla por red aunque onLine=true, encolar igual */
      const q = _readQueue();
      const idx = q.findIndex(i => i.key === key);
      const item = { key, value: parsed, ts };
      if (idx >= 0) q[idx] = item; else q.push(item);
      _saveQueue(q);
      window.dispatchEvent(new CustomEvent('sh:sync-status', { detail: 'offline' }));
    });
  },

  removeItem(key) {
    try { localStorage.removeItem(key); } catch {}
    if (_currentUserId) {
      supabase.from('app_data').delete().match({ user_id: _currentUserId, key }).catch(() => {});
    }
  },

  clear() {
    try { localStorage.clear(); } catch {}
    if (_currentUserId) {
      supabase.from('app_data').delete().eq('user_id', _currentUserId).catch(() => {});
    }
  },
};
