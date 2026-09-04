import React, { useState, useRef, useEffect } from "react";

const AREAS = ["Sport", "Retail", "Uffici"];
const EXAMPLES = {
  Sport: "Proiettori per un campo da calcio a 11 outdoor, competizione amatoriale, con gestione da remoto.",
  Retail: "Illuminazione d'accento a binario per un flagship store, con buona resa cromatica.",
  Uffici: "Pannelli ad alta efficienza per un open space, con sensori di presenza e reporting energetico.",
};
const FALLBACK = "https://www.signify.com/global/prof";
const isUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);
const brandColor = { Philips: "#3b7dd8", "Vari-Lite": "#c065d6", Interact: "#28b487", "Color Kinetics": "#e8863b", Signify: "#d4a13a" };

const SYSTEM = `Sei lo "Specification Agent" di Signify: una ricerca intelligente del catalogo, pensata per il sito vetrina B2B.
Il tuo compito NON è vendere né fare un preventivo, ma aiutare progettisti e lighting designer a NAVIGARE il catalogo Signify e capire quale prodotto o sistema si adatta al loro progetto, rimandandoli poi alla scheda prodotto reale.

Come lavori:
- Usa la ricerca web per trovare sul sito Signify (domini: signify.com, lighting.philips.com, interact-lighting.com, vari-lite.com) le FAMIGLIE e i PRODOTTI reali che rispondono al bisogno descritto.
- Per ciascuno: nome reale, brand (Philips / Interact / Vari-Lite / Color Kinetics / Signify), area (Sport/Retail/Uffici), 2-4 caratteristiche tecniche chiave sintetiche, una riga in linguaggio semplice sul PERCHÉ è adatto, e l'URL reale della pagina prodotto/famiglia trovata nella ricerca.
- Includi il sistema pertinente quando ha senso: Interact Sports / Retail / Office.
- Proponi 3-5 opzioni, dalla più adatta in giù. Se il bisogno è ampio, spiega le differenze tra le opzioni.

Confini (importante):
- NON calcoli progetti illuminotecnici certificati. Se dai riferimenti a lux/norme, sono indicativi da validare con un progetto (es. DIALux).
- NON scavalchi gli strumenti del sito: per prezzi, configurazione di dettaglio o supporto, indirizza a configuratore / richiesta preventivo / contatto.
- Usa SOLO URL realmente presenti nei risultati di ricerca. Se non trovi un URL affidabile per un prodotto, ometti il campo url per quell'item.
- Rispondi SEMPRE in italiano.

Dopo aver cercato, rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza backtick:
{"reply":"1-2 frasi in italiano che inquadrano i risultati","products":[{"name":"","brand":"","area":"","highlights":["",""],"why":"","url":""}],"next":"nota breve sul passo successivo consigliato (configuratore/preventivo/supporto) o null"}`;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sel, setSel] = useState([]); // prodotti salvati
  const [panelOpen, setPanelOpen] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const keyOf = (p) => p.url || p.name;
  const addSel = (p) => setSel((s) => (s.some((x) => keyOf(x) === keyOf(p)) ? s : [...s, p]));
  const rmSel = (p) => setSel((s) => s.filter((x) => keyOf(x) !== keyOf(p)));
  const inSel = (p) => sel.some((x) => keyOf(x) === keyOf(p));

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", reply: q }]);
    const newHistory = [...history, { role: "user", content: q }];
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: SYSTEM,
          messages: newHistory,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
        }),
      });
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      if (data.type === "error" || data.error) throw new Error(data.error?.message || "api error");
      let raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      raw = raw.replace(/^[^{]*/, "").replace(/```/g, "");
      let parsed = safeParse(raw);
      if (!parsed) parsed = { reply: "Ricerca incompleta. Riprova o riformula il bisogno di progetto.", products: [], next: null };
      const prods = (parsed.products || []).filter((p) => p && p.name);
      setMessages((m) => [...m, { role: "agent", reply: parsed.reply || "", products: prods, next: parsed.next }]);
      const note = prods.length ? ` [Trovati: ${prods.map((p) => p.name).join("; ")}]` : "";
      setHistory([...newHistory, { role: "assistant", content: (parsed.reply || "") + note }]);
    } catch (e) {
      setError(e.name === "AbortError" ? "La ricerca ci ha messo troppo (timeout). Riprova." : "Connessione non riuscita. Riprova.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

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

  return (
    <div className="sp-root">
      <style>{css}</style>

      <header className="sp-head">
        <div className="sp-mark"><span className="sp-dot" /> Specification Agent</div>
        <div className="sp-sub">Ricerca intelligente del catalogo Signify</div>
      </header>

      <div className="sp-body">
        <main className="sp-chat" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="sp-empty">
              <div className="sp-glow" />
              <h1>Descrivi il progetto.<br />Ti porto ai prodotti giusti.</h1>
              <p>Dimmi cosa devi illuminare e cerco nel catalogo Signify le famiglie adatte, con i punti tecnici chiave e il link alla scheda prodotto reale. Non sostituisco il configuratore né il supporto: ti ci accompagno.</p>
              <div className="sp-chips">
                {AREAS.map((a) => (
                  <button key={a} className="sp-chip" onClick={() => send(EXAMPLES[a])}>
                    <span className="sp-chip-tag">{a}</span>{EXAMPLES[a]}
                  </button>
                ))}
              </div>
              <div className="sp-note">Ricerca dal vivo sul sito Signify · riferimenti tecnici indicativi, da validare in fase di progetto</div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="sp-user">{m.reply}</div>
            ) : (
              <div key={i} className="sp-agent">
                <div className="sp-agent-reply">{m.reply}</div>
                {m.products?.length > 0 && (
                  <div className="sp-cards">
                    {m.products.map((p, j) => (
                      <div key={j} className={"sp-card" + (/interact|sports|office|retail/i.test(p.brand) && p.brand === "Interact" ? " sp-card-sys" : "")}>
                        <div className="sp-badges">
                          <span className="sp-badge" style={{ color: brandColor[p.brand] || "#9aa" }}>{p.brand || "Signify"}</span>
                          {p.area && <span className="sp-badge sp-badge-area">{p.area}</span>}
                        </div>
                        <div className="sp-card-name">{p.name}</div>
                        {p.highlights?.length > 0 && (
                          <div className="sp-specs">
                            {p.highlights.slice(0, 4).map((h, k) => <span key={k}>{h}</span>)}
                          </div>
                        )}
                        {p.why && <div className="sp-reason">{p.why}</div>}
                        <div className="sp-actions">
                          <a className="sp-link" href={isUrl(p.url) ? p.url : FALLBACK} target="_blank" rel="noopener noreferrer">
                            {isUrl(p.url) ? "Apri scheda prodotto ↗" : "Cerca sul sito ↗"}
                          </a>
                          <button className={"sp-save" + (inSel(p) ? " sp-saved" : "")} onClick={() => (inSel(p) ? rmSel(p) : addSel(p))}>
                            {inSel(p) ? "✓ In selezione" : "Salva"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {m.next && <div className="sp-next">Prossimo passo: {m.next}</div>}
              </div>
            )
          )}

          {loading && (
            <div className="sp-agent">
              <div className="sp-typing"><span /><span /><span /></div>
              <div className="sp-searching">Cerco nel catalogo Signify…</div>
            </div>
          )}
          {error && <div className="sp-error">{error}</div>}
        </main>

        <div className={"sp-backdrop" + (panelOpen ? " sp-backdrop-on" : "")} onClick={() => setPanelOpen(false)} />
        <aside className={"sp-side" + (panelOpen ? " sp-side-open" : "")}>
          <div className="sp-side-head">
            La tua selezione
            <button className="sp-side-close" onClick={() => setPanelOpen(false)}>Chiudi</button>
          </div>
          {sel.length === 0 ? (
            <div className="sp-side-empty">Salva qui i prodotti che ti interessano, poi porta la selezione al supporto o al preventivo — con il contesto già pronto.</div>
          ) : (
            <div className="sp-side-list">
              {sel.map((p, j) => (
                <div key={j} className="sp-line">
                  <div className="sp-line-info">
                    <div className="sp-line-name">{p.name}</div>
                    <div className="sp-line-sub">{p.brand}{p.area ? " · " + p.area : ""}</div>
                    {isUrl(p.url) && <a className="sp-line-link" href={p.url} target="_blank" rel="noopener noreferrer">Scheda ↗</a>}
                  </div>
                  <button className="sp-rm" onClick={() => rmSel(p)}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="sp-side-foot">
            <button className="sp-cta" disabled={sel.length === 0}>Richiedi supporto su questi prodotti</button>
            <div className="sp-cta-note">La selezione viene passata al form come contesto — nessun prezzo, nessun ordine automatico.</div>
          </div>
        </aside>
      </div>

      {sel.length > 0 && (
        <button className="sp-sidebtn" onClick={() => setPanelOpen((o) => !o)}>
          <span className="sp-sidebtn-count">{sel.length}</span>Selezione
        </button>
      )}

      <div className="sp-inputbar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Descrivi il progetto: applicazione, spazio, esigenze tecniche…"
          disabled={loading}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}>Cerca</button>
      </div>
    </div>
  );
}

const css = `
* { box-sizing:border-box; }
.sp-root {
  --ink:#0b0f14; --panel:#141a22; --panel2:#1b222c; --line:#28313d;
  --text:#e9edf2; --mut:#8994a3; --acc:#35c1e8; --acc-dim:#1d5a6e;
  font-family:"Söhne",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  background:var(--ink); color:var(--text); height:100vh; display:flex; flex-direction:column; overflow:hidden; letter-spacing:-.01em;
}
.sp-head { padding:15px 22px; border-bottom:1px solid var(--line); display:flex; align-items:baseline; gap:14px; }
.sp-mark { font-weight:600; font-size:16px; display:flex; align-items:center; gap:9px; }
.sp-dot { width:9px; height:9px; border-radius:50%; background:var(--acc); box-shadow:0 0 14px 2px var(--acc); }
.sp-sub { color:var(--mut); font-size:12.5px; }

.sp-body { flex:1; display:flex; min-height:0; }
.sp-chat { flex:1; overflow-y:auto; padding:26px 24px 36px; display:flex; flex-direction:column; gap:16px; }

.sp-empty { margin:auto; max-width:600px; text-align:center; position:relative; padding:30px 0; }
.sp-glow { position:absolute; inset:-50px 0 auto; height:200px; width:200px; margin:auto; left:0; right:0;
  background:radial-gradient(circle,rgba(53,193,232,.2),transparent 65%); filter:blur(8px); }
.sp-empty h1 { font-size:31px; line-height:1.14; font-weight:600; margin:0 0 13px; position:relative; }
.sp-empty p { color:var(--mut); font-size:14.5px; line-height:1.55; margin:0 auto 24px; max-width:500px; }
.sp-chips { display:flex; flex-direction:column; gap:9px; text-align:left; }
.sp-chip { background:var(--panel); border:1px solid var(--line); color:var(--text); padding:12px 14px;
  border-radius:11px; font-size:13px; cursor:pointer; transition:border-color .15s,background .15s; font-family:inherit; line-height:1.45; }
.sp-chip:hover { border-color:var(--acc-dim); background:var(--panel2); }
.sp-chip-tag { display:inline-block; background:var(--acc-dim); color:#cdeef8; font-size:11px; font-weight:600; padding:2px 8px; border-radius:6px; margin-right:9px; vertical-align:middle; }
.sp-note { margin-top:18px; color:var(--mut); font-size:11.5px; opacity:.85; }

.sp-user { align-self:flex-end; max-width:80%; background:var(--acc); color:#04222b; padding:11px 15px; border-radius:14px 14px 3px 14px; font-size:14px; line-height:1.4; font-weight:450; }
.sp-agent { align-self:flex-start; max-width:94%; display:flex; flex-direction:column; gap:11px; }
.sp-agent-reply { background:var(--panel); border:1px solid var(--line); padding:13px 16px; border-radius:14px 14px 14px 3px; font-size:14px; line-height:1.5; white-space:pre-wrap; }

.sp-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:11px; }
.sp-card { background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:13px; display:flex; flex-direction:column; gap:8px; }
.sp-card-sys { background:linear-gradient(180deg,rgba(53,193,232,.05),var(--panel)); border-color:var(--acc-dim); }
.sp-badges { display:flex; flex-wrap:wrap; gap:6px; }
.sp-badge { font-size:10.5px; font-weight:600; }
.sp-badge-area { color:var(--mut); background:var(--panel2); border:1px solid var(--line); border-radius:5px; padding:1px 6px; font-weight:500; }
.sp-card-name { font-weight:600; font-size:14.5px; line-height:1.25; }
.sp-specs { display:flex; flex-wrap:wrap; gap:5px; }
.sp-specs span { background:var(--panel2); border:1px solid var(--line); border-radius:6px; padding:2px 7px; font-size:10.5px; color:var(--mut); }
.sp-reason { font-size:12.5px; line-height:1.45; color:#c3ccd6; flex:1; }
.sp-actions { display:flex; gap:7px; align-items:center; margin-top:2px; }
.sp-link { flex:1; text-align:center; text-decoration:none; background:transparent; border:1px solid var(--acc-dim); color:var(--acc); font-weight:550; padding:8px; border-radius:9px; font-size:12px; transition:background .15s; }
.sp-link:hover { background:rgba(53,193,232,.1); }
.sp-save { background:var(--panel2); border:1px solid var(--line); color:var(--text); font-weight:500; padding:8px 11px; border-radius:9px; cursor:pointer; font-size:12px; font-family:inherit; white-space:nowrap; }
.sp-saved { border-color:var(--acc-dim); color:var(--acc); }

.sp-next { align-self:flex-start; font-size:12px; color:#cfeaf3; background:rgba(53,193,232,.06); border:1px solid var(--acc-dim); border-radius:9px; padding:8px 12px; }
.sp-typing { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px 16px; display:flex; gap:5px; width:fit-content; }
.sp-typing span { width:7px; height:7px; border-radius:50%; background:var(--mut); animation:bl 1.2s infinite; }
.sp-typing span:nth-child(2){animation-delay:.2s;} .sp-typing span:nth-child(3){animation-delay:.4s;}
@keyframes bl {0%,60%,100%{opacity:.25;}30%{opacity:1;}}
.sp-searching { font-size:12px; color:var(--mut); padding-left:4px; }
.sp-error { align-self:flex-start; color:#ff9a8a; font-size:13px; background:rgba(255,80,60,.08); border:1px solid rgba(255,80,60,.3); padding:10px 14px; border-radius:10px; }

.sp-side { width:320px; border-left:1px solid var(--line); display:flex; flex-direction:column; background:var(--panel); }
.sp-side-head { padding:17px 20px 13px; font-weight:600; font-size:14.5px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; }
.sp-side-close { display:none; background:var(--panel2); border:1px solid var(--line); color:var(--mut); font-size:12px; padding:5px 11px; border-radius:8px; cursor:pointer; font-family:inherit; }
.sp-side-empty { padding:22px 20px; color:var(--mut); font-size:12.5px; line-height:1.55; }
.sp-side-list { flex:1; overflow-y:auto; padding:8px 14px; }
.sp-line { display:flex; justify-content:space-between; align-items:flex-start; padding:11px 6px; border-bottom:1px solid var(--line); gap:8px; }
.sp-line-name { font-size:13px; font-weight:500; }
.sp-line-sub { font-size:11px; color:var(--mut); margin-top:2px; }
.sp-line-link { font-size:11px; color:var(--acc); text-decoration:none; display:inline-block; margin-top:4px; }
.sp-rm { background:none; border:none; color:var(--mut); font-size:18px; cursor:pointer; line-height:1; padding:0 4px; }
.sp-side-foot { padding:15px 20px; border-top:1px solid var(--line); }
.sp-cta { width:100%; background:var(--acc); color:#04222b; border:none; font-weight:600; padding:12px; border-radius:10px; cursor:pointer; font-size:13.5px; font-family:inherit; }
.sp-cta:disabled { opacity:.4; cursor:not-allowed; }
.sp-cta-note { margin-top:9px; font-size:11px; color:var(--mut); line-height:1.45; }

.sp-backdrop { display:none; }
.sp-sidebtn { display:none; }

.sp-inputbar { display:flex; gap:10px; padding:13px 22px; border-top:1px solid var(--line); background:var(--ink); }
.sp-inputbar input { flex:1; background:var(--panel); border:1px solid var(--line); border-radius:11px; padding:13px 16px; color:var(--text); font-size:14px; font-family:inherit; outline:none; }
.sp-inputbar input:focus { border-color:var(--acc-dim); }
.sp-inputbar button { background:var(--acc); color:#04222b; border:none; font-weight:600; padding:0 22px; border-radius:11px; cursor:pointer; font-size:14px; font-family:inherit; }
.sp-inputbar button:disabled { opacity:.4; cursor:not-allowed; }

@media (max-width:760px){
  .sp-empty h1 { font-size:25px; }
  .sp-agent, .sp-user { max-width:100%; }
  .sp-backdrop { display:block; position:fixed; inset:0; background:rgba(0,0,0,.55); opacity:0; pointer-events:none; transition:opacity .2s; z-index:25; }
  .sp-backdrop-on { opacity:1; pointer-events:auto; }
  .sp-side { position:fixed; left:0; right:0; bottom:0; width:auto; max-height:74vh; border-left:none; border-top:1px solid var(--line);
    border-radius:16px 16px 0 0; transform:translateY(106%); transition:transform .26s ease; z-index:30; box-shadow:0 -12px 40px rgba(0,0,0,.5); }
  .sp-side-open { transform:translateY(0); }
  .sp-side-close { display:block; }
  .sp-sidebtn { display:flex; align-items:center; gap:9px; position:fixed; right:16px; bottom:74px; z-index:20;
    background:var(--acc); color:#04222b; border:none; font-weight:600; font-size:13px; padding:11px 16px; border-radius:22px; cursor:pointer;
    font-family:inherit; box-shadow:0 6px 20px rgba(53,193,232,.35); }
  .sp-sidebtn-count { background:#04222b; color:var(--acc); min-width:20px; height:20px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; font-size:11px; padding:0 5px; }
}
`;
