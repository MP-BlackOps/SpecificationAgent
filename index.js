import express from "express";
import cors from "cors";
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";

const PORT = process.env.PORT || 8787;
const MODEL = process.env.MODEL || "claude-sonnet-4-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("Manca ANTHROPIC_API_KEY. Copia server/.env.example in server/.env e inserisci la chiave.");
  process.exit(1);
}

// Catalogo di riferimento (sostituisci catalog.sample.json col tuo JSON reale, o rinominalo catalog.json)
let CATALOG = "";
for (const f of ["catalog.json", "catalog.sample.json"]) {
  if (existsSync(new URL(f, import.meta.url))) {
    CATALOG = readFileSync(new URL(f, import.meta.url), "utf8");
    break;
  }
}

const SYSTEM = `Sei lo "Specification Agent" di Signify: una ricerca intelligente del catalogo per il sito vetrina B2B.
Il tuo compito NON e vendere ne fare un preventivo, ma aiutare progettisti e lighting designer a NAVIGARE il catalogo Signify e capire quale prodotto o sistema si adatta al loro progetto, rimandandoli poi alla scheda prodotto reale.

Catalogo di riferimento Signify (fonte di verita su cosa esiste a gamma):
${CATALOG || "(nessun catalogo caricato: usa la ricerca web sul sito Signify)"}

Come lavori:
- Usa la ricerca web per trovare sul sito Signify (domini: signify.com, lighting.philips.com, interact-lighting.com, vari-lite.com) le pagine reali dei prodotti/famiglie che rispondono al bisogno.
- Per ciascuno: nome reale, brand (Philips / Interact / Vari-Lite / Color Kinetics / Signify), area (Sport/Retail/Uffici), 2-4 caratteristiche tecniche chiave sintetiche, una riga in linguaggio semplice sul PERCHE e adatto, e l'URL reale della pagina trovata.
- Includi il sistema pertinente quando ha senso (Interact Sports/Retail/Office).
- Proponi 3-5 opzioni, dalla piu adatta in giu.

Confini (importante):
- NON calcoli progetti illuminotecnici certificati; eventuali riferimenti a lux/norme sono indicativi.
- NON scavalchi gli strumenti del sito: per prezzi, configurazione di dettaglio o supporto, indirizza a configuratore / preventivo / contatto.
- Usa SOLO URL realmente presenti nei risultati di ricerca; se non ne trovi uno affidabile, ometti il campo url per quell'item.
- Rispondi SEMPRE in italiano.

Dopo aver cercato, rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza backtick:
{"reply":"1-2 frasi in italiano","products":[{"name":"","brand":"","area":"","highlights":["",""],"why":"","url":""}],"next":"nota breve sul passo successivo o null"}`;

function safeParse(s) {
  try { return JSON.parse(s); } catch {}
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/spec", async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: "messages mancanti" });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      }),
    });
    const data = await r.json();
    if (!r.ok || data.error) {
      console.error("Anthropic error:", data);
      return res.status(502).json({ error: data.error?.message || "errore upstream" });
    }
    let raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    raw = raw.replace(/^[^{]*/, "").replace(/```/g, "");
    const parsed = safeParse(raw) || { reply: "Ricerca incompleta, riprova.", products: [], next: null };
    res.json(parsed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "errore interno" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, model: MODEL }));
app.listen(PORT, () => console.log(`Spec Agent backend su http://localhost:${PORT} (modello: ${MODEL})`));
