// storage-adapter.js
//
// Sustituye window.storage (el almacenamiento del artefacto) por Supabase, sin tener que
// tocar casi nada de mi-agenda.jsx: exporta un objeto `storage` con la MISMA forma exacta
// que window.storage.get/set/delete/list (mismos parámetros, misma forma de respuesta),
// así que loadKey/saveKey y el sistema de copias de seguridad de mi-agenda.jsx siguen
// funcionando tal cual están, sin reescribir su lógica.
//
// Instalación:
//   npm install @supabase/supabase-js
//
// Variables de entorno (.env en la raíz del proyecto):
//   VITE_SUPABASE_URL=...
//   VITE_SUPABASE_ANON_KEY=...
// (la anon key es pública por diseño — la seguridad real la da Row Level Security en la
// base de datos, no esta clave; nunca uses aquí la "service_role" key)

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function currentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ? user.id : null;
}

// Shim con la misma forma que window.storage — pensado para asignarse como
// `window.storage = storage` una vez, al arrancar la app (ver main.jsx en SETUP.md).
export const storage = {
  async get(key) {
    const userId = await currentUserId();
    if (!userId) return null;
    const { data, error } = await supabase
      .from("user_data").select("value")
      .eq("user_id", userId).eq("key", key).maybeSingle();
    if (error || !data) return null;
    return { key, value: JSON.stringify(data.value), shared: false };
  },
  async set(key, value /* string ya JSON.stringify */) {
    const userId = await currentUserId();
    if (!userId) return null;
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    const { error } = await supabase
      .from("user_data").upsert({ user_id: userId, key, value: parsed }, { onConflict: "user_id,key" });
    if (error) { console.error("Error guardando " + key, error); return null; }
    return { key, value, shared: false };
  },
  async delete(key) {
    const userId = await currentUserId();
    if (!userId) return null;
    const { error } = await supabase.from("user_data").delete().eq("user_id", userId).eq("key", key);
    if (error) return null;
    return { key, deleted: true, shared: false };
  },
  async list(prefix) {
    const userId = await currentUserId();
    if (!userId) return null;
    let query = supabase.from("user_data").select("key").eq("user_id", userId);
    if (prefix) query = query.like("key", `${prefix}%`);
    const { data, error } = await query;
    if (error) return null;
    return { keys: data.map((r) => r.key), prefix, shared: false };
  },
};

// Ayudas de sesión, para la pantalla de login/registro (AuthGate.jsx).
export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}
export async function signOut() {
  return supabase.auth.signOut();
}
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
