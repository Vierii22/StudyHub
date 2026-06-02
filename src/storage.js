import { supabase } from './supabase.js';

let _currentUserId = null;
let _channel = null;

function _clearLocalStorage() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('studyhub'))
      .forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('studyhub-config');
  } catch (e) {}
}

async function _getUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch (e) {
    return null;
  }
}

async function _supabaseSet(key, value) {
  const userId = await _getUserId();
  if (!userId) return;
  let jsonValue;
  try { jsonValue = JSON.parse(value); } catch (e) { jsonValue = value; }
  await supabase.from('app_data').upsert(
    { user_id: userId, key, value: jsonValue, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' }
  );
}

async function _supabaseRemove(key) {
  const userId = await _getUserId();
  if (!userId) return;
  await supabase.from('app_data').delete().match({ user_id: userId, key });
}

async function _supabaseClear() {
  const userId = await _getUserId();
  if (!userId) return;
  await supabase.from('app_data').delete().eq('user_id', userId);
}

function _stopRealtime() {
  if (_channel) {
    supabase.removeChannel(_channel);
    _channel = null;
  }
}

function _startRealtime(userId) {
  _stopRealtime();
  _channel = supabase
    .channel('app_data_sync_' + userId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'app_data',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const { key, value } = payload.new;
        const stored = typeof value === 'string' ? value : JSON.stringify(value);
        try { localStorage.setItem(key, stored); } catch (e) {}
        window.dispatchEvent(new CustomEvent('sh:storage-sync', { detail: { key, value } }));
      } else if (payload.eventType === 'DELETE') {
        const key = payload.old?.key;
        if (key) {
          try { localStorage.removeItem(key); } catch (e) {}
          window.dispatchEvent(new CustomEvent('sh:storage-sync', { detail: { key, value: null } }));
        }
      }
    })
    .subscribe();
}

async function _initialSync() {
  const userId = await _getUserId();
  if (!userId) return;
  _currentUserId = userId;
  const { data, error } = await supabase
    .from('app_data')
    .select('key, value')
    .eq('user_id', userId);
  if (!error && data) {
    for (const row of data) {
      const stored = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
      try { localStorage.setItem(row.key, stored); } catch (e) {}
    }
  }
  _startRealtime(userId);
  window.dispatchEvent(new CustomEvent('sh:user-synced'));
}

// Re-sincronizar cuando cambia el usuario (login/logout en la misma pestaña)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    const newUserId = session?.user?.id;
    if (newUserId && newUserId !== _currentUserId) {
      _initialSync();
    }
  } else if (event === 'SIGNED_OUT') {
    _currentUserId = null;
    _clearLocalStorage();
    _stopRealtime();
  }
});

_initialSync();

export const SupabaseStorage = {
  isElectron: false,
  isReady: () => true,
  onReady: (cb) => cb(),

  getItem(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },

  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
    _supabaseSet(key, value).catch(() => {});
  },

  removeItem(key) {
    try { localStorage.removeItem(key); } catch (e) {}
    _supabaseRemove(key).catch(() => {});
  },

  clear() {
    try { localStorage.clear(); } catch (e) {}
    _supabaseClear().catch(() => {});
  },
};
