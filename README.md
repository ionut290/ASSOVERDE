# Assoverde Preventivi (React + FastAPI)

MVP per creare preventivi partendo da un prezzario:
- inserimento voci prezzario,
- upload prezzario da file Excel,
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
