import React, { useState, useRef, useEffect } from "react";
import { specSearch } from "./api.js";

const AREAS = ["Sport", "Retail", "Uffici"];
const EXAMPLES = {
  Sport: "Proiettori per un campo da calcio a 11 outdoor, competizione amatoriale, con gestione da remoto.",
  Retail: "Illuminazione d'accento a binario per un flagship store, con buona resa cromatica.",
  Uffici: "Pannelli ad alta efficienza per un open space, con sensori di presenza e reporting energetico.",
};
const FALLBACK = "https://www.signify.com/global/prof";
const isUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u);
const brandColor = {
  Philips: "#3b7dd8", "Vari-Lite": "#c065d6", Interact: "#28b487",
  "Color Kinetics": "#e8863b", Signify: "#d4a13a",
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sel, setSel] = useState([]);
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
      const data = await specSearch(newHistory, ctrl.signal);
      const prods = (data.products || []).filter((p) => p && p.name);
      setMessages((m) => [...m, { role: "agent", reply: data.reply || "", products: prods, next: data.next }]);
      const note = prods.length ? ` [Trovati: ${prods.map((p) => p.name).join("; ")}]` : "";
      setHistory([...newHistory, { role: "assistant", content: (data.reply || "") + note }]);
    } catch (e) {
      setError(e.name === "AbortError" ? "La ricerca ci ha messo troppo (timeout). Riprova." : "Connessione non riuscita. Verifica che il backend sia attivo.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  return (
    <div className="sp-root">
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
              <p>Dimmi cosa devi illuminare e cerco nel catalogo Signify le famiglie adatte, con i punti tecnici chiave e il link alla scheda prodotto reale. Non sostituisco il configuratore ne il supporto: ti ci accompagno.</p>
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
                      <div key={j} className={"sp-card" + (p.brand === "Interact" ? " sp-card-sys" : "")}>
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
            <div className="sp-side-empty">Salva qui i prodotti che ti interessano, poi porta la selezione al supporto o al preventivo — con il contesto gia pronto.</div>
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
