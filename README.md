# Signify — Specification Agent (prototipo)

Ricerca intelligente del catalogo Signify per il sito vetrina B2B.
Il designer descrive il progetto a parole; l'agente cerca sul catalogo Signify, spiega i
prodotti adatti e rimanda alla scheda prodotto reale. **Non** scavalca configuratore,
preventivo o supporto: li alimenta.

## Architettura (perche e divisa in due)

- **Front-end** (`/src`): la schermata. Codice web normale, nessuna chiave API. Puo girare
  ovunque. Parla solo col backend, tramite `POST /api/spec`.
- **Back-end** (`/server`): tiene la chiave API Anthropic e fa la chiamata al modello con la
  ricerca web attiva. E il "cervello".

La chiave API sta **solo** nel backend: non finisce mai nel front-end ne nel repo pubblico.

Contratto tra i due:
    POST /api/spec
    body:  { "messages": [ { "role": "user", "content": "..." }, ... ] }
    reply: { "reply": "...", "products": [ { name, brand, area, highlights[], why, url } ], "next": "..." }

## Avvio in locale

### 1. Backend
    cd server
    cp .env.example .env        # inserisci ANTHROPIC_API_KEY e MODEL
    npm install
    npm run dev                 # http://localhost:8787

Sostituisci `server/catalog.sample.json` con il tuo JSON reale (rinominalo `catalog.json`).

### 2. Front-end
    cp .env.example .env        # VITE_API_BASE=http://localhost:8787
    npm install
    npm run dev                 # http://localhost:5173

## Punti di integrazione (dove mettere le mani)

- **Catalogo**: `server/catalog.json` — il tuo export reale (PIM/catalogo). E la fonte di verita.
- **Modello / prompt**: `server/index.js` — costante `SYSTEM` e `MODEL`.
- **CTA supporto**: in `src/App.jsx` il bottone "Richiedi supporto" e un segnaposto:
  agganciarlo al vostro form, passando `sel` (la selezione) come contesto.
- **Link prodotto**: arrivano dalla ricerca web. Per garanzia totale sui link, in produzione
  conviene mapparli sul vostro catalogo invece che sulla ricerca.

## Note oneste

- I riferimenti tecnici (lux, ecc.) sono indicativi: complementano DIALux e il progettista,
  non li sostituiscono.
- La ricerca web puo non trovare sempre la scheda esatta: in quel caso il link e un fallback
  al catalogo. In produzione, usare il catalogo interno per i link e la scelta piu solida.
- Costi/limiti/sicurezza (rate limiting, auth, logging) vanno aggiunti prima di esporlo al pubblico.

## Deploy (sintesi)

- Front-end: `npm run build` -> cartella `dist/` su qualsiasi hosting statico.
- Back-end: un piccolo servizio Node (con la chiave in variabile d'ambiente) su un host a scelta.
- In alternativa, il backend puo puntare a Amazon Bedrock / Google Vertex / Azure Foundry
  invece dell'API Anthropic diretta: cambia solo la chiamata dentro `server/index.js`.
