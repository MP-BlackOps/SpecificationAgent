// Unico punto in cui il front-end parla col backend.
// Il front-end NON conosce la chiave API: la tiene il backend (/server).
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

// Invia la conversazione e riceve { reply, products, next } gia strutturato.
export async function specSearch(messages, signal) {
  const res = await fetch(`${API_BASE}/api/spec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok) throw new Error("http " + res.status);
  return res.json();
}
