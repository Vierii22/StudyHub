import React from 'react';
import { supabase } from '../supabase.js';

/* ============================================================
   NOTIFICACIONES PUSH — avisos aunque la app esté cerrada
   (reemplaza al bot de Telegram para esto). Requiere:
   - VITE_VAPID_PUBLIC_KEY en las variables de entorno (build)
   - tabla push_subscriptions en Supabase (supabase/push-subscriptions-setup.sql)
   - VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY en Vercel (server, api/send-reminders.js)
   ============================================================ */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function getSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch { return null; }
}

async function subscribePush() {
  if (!VAPID_PUBLIC_KEY) { console.error("Falta VITE_VAPID_PUBLIC_KEY"); return null; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (userId) {
    const json = sub.toJSON();
    await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    }, { onConflict: "endpoint" });
  }
  return sub;
}

async function unsubscribePush() {
  const sub = await getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch {}
  try { await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint); } catch {}
}

/* estado: "unsupported" | "denied" | "subscribed" | "unsubscribed" | "checking" */
function usePushNotifications() {
  const [status, setStatus] = React.useState("checking");

  const refresh = React.useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setStatus("unsupported"); return; }
    if (Notification.permission === "denied") { setStatus("denied"); return; }
    const sub = await getSubscription();
    setStatus(sub ? "subscribed" : "unsubscribed");
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const enable = async () => {
    const sub = await subscribePush();
    if (sub) setStatus("subscribed");
    else setStatus(Notification.permission === "denied" ? "denied" : "unsubscribed");
  };
  const disable = async () => { await unsubscribePush(); setStatus("unsubscribed"); };

  return { status, enable, disable };
}

export { usePushNotifications, subscribePush, unsubscribePush, getSubscription };
