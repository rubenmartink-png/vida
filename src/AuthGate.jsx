// AuthGate.jsx
//
// Envuelve tu <App /> con esto. Muestra login/registro si no hay sesión,
// y solo renderiza la app real una vez que el usuario ha iniciado sesión.
//
// Uso en tu punto de entrada:
//   import AuthGate from "./AuthGate";
//   import App from "./mi-agenda";
//   <AuthGate><App /></AuthGate>

import { useState, useEffect, cloneElement, isValidElement } from "react";
import { supabase, signUp, signIn, signOut, onAuthChange } from "./storage-adapter";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando, null = sin sesión
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = onAuthChange((s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (!email.trim() || !password.trim()) { setError("Rellena email y contraseña."); return; }
    setError(""); setBusy(true);
    const { error: err } = mode === "signup" ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err.message);
  };

  // Nombre solo si el proveedor de login lo aporta (p. ej. Google); con email y contraseña queda en blanco.
  const meta = (session && session.user && session.user.user_metadata) || {};
  const fullName = meta.full_name || meta.name || "";
  const userName = fullName.trim().split(/\s+/)[0] || "";

  if (session === undefined) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Cargando…</div>;
  }

  if (!session) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Vida</h1>
        <p style={{ color: "#666", marginBottom: 20 }}>{mode === "signup" ? "Crea tu cuenta" : "Inicia sesión"}</p>
        <input
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <input
          type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        {error && <p style={{ color: "crimson", fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#6C5CE7", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          {busy ? "Un momento…" : mode === "signup" ? "Crear cuenta" : "Entrar"}
        </button>
        <p style={{ fontSize: 13, marginTop: 14, textAlign: "center" }}>
          {mode === "signup" ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}>
            {mode === "signup" ? "Inicia sesión" : "Regístrate"}
          </a>
        </p>
      </div>
    );
  }

  return (
    <>
      <button onClick={signOut} style={{ position: "fixed", top: 10, right: 10, zIndex: 999, fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
        Cerrar sesión
      </button>
      {isValidElement(children) ? cloneElement(children, { userName }) : children}
    </>
  );
}
