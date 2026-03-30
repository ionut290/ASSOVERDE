# Assoverde Preventivi (React + FastAPI)

MVP per creare preventivi partendo da un prezzario:
- inserimento voci prezzario,
- upload prezzario da file Excel,
- riscontro upload (righe lette/inserite/saltate),
- suggerimenti automatici in base alla descrizione del lavoro,
- creazione del preventivo con totale.

## Struttura

- `backend/` API FastAPI + SQLite
- `frontend/` app React (Vite)
- `netlify.toml` configurazione deploy Netlify (frontend + fallback SPA)

## Avvio backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend disponibile su `http://localhost:8000`.

## Avvio frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponibile su `http://localhost:5173`.

Se il backend non è su `http://localhost:8000`, imposta:

```bash
cd frontend
VITE_API_URL="https://tuo-backend.example.com" npm run dev
```

In alternativa (anche in produzione), puoi impostare l'URL backend direttamente dal campo
**Configurazione API backend** nella UI: il valore viene salvato in `localStorage`.

## Build frontend

```bash
cd frontend
npm run build
```

## Upload Excel prezzario

Endpoint: `POST /pricelist/upload` (multipart/form-data, campo `file`).

Formato colonne richiesto nella prima riga del file Excel:
- `codice_prezzo`
- `capitolo`
- `descrizione`
- `unita_misura`
- `prezzo_unitario`

Alias accettati per alcune colonne (esempio):
- `unità di misura`, `unita di misura`, `um`
- `prezzo`, `prezzo orario`, `prezzo unitario`

Estensioni supportate: `.xlsx`, `.xlsm`, `.xltx`, `.xltm`.

Risposta upload:
- `total_rows`: righe lette dal file
- `inserted`: righe inserite
- `skipped`: righe saltate (es. codice già presente o dati non validi)

## Menu Prezzario (frontend)

Nel frontend è presente un menu con due viste:
- **Preventivo**: creazione preventivo con suggerimenti
- **Prezzario**: elenco tabellare completo delle voci con ricerca

## Deploy su Netlify (fix 404 / Page not found)

Questa repo include già i fix per evitare la pagina 404 in una SPA React:
- `netlify.toml` usa `frontend` come base e `frontend/dist` come publish dir.
- redirect globale `/* -> /index.html 200` (sia in `netlify.toml` che in `frontend/public/_redirects`).

Se configuri il sito manualmente su Netlify:
- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `dist`

## Endpoints principali

- `POST /pricelist/items` crea voce prezzario
- `POST /pricelist/upload` upload prezzario da Excel
- `GET /pricelist/items` elenco voci (con `?search=`)
- `POST /quotes/suggest` suggerisce voci da testo lavoro
- `POST /quotes` crea preventivo

## Note MVP

- algoritmo suggerimenti basato su parole chiave (matching testuale)
- autenticazione non inclusa
- export PDF non incluso in questa prima versione
