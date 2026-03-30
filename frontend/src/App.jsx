import { useEffect, useMemo, useState } from 'react'

const DEFAULT_API_URL = import.meta.env.VITE_API_URL
  || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : `${window.location.origin}/api`)

const emptyForm = {
  codice_prezzo: '',
  capitolo: 'NOLEGGI',
  descrizione: '',
  unita_misura: 'ora',
  prezzo_unitario: ''
}

function loadLocalItems() {
  try {
    return JSON.parse(localStorage.getItem('local_pricelist_items') || '[]')
  } catch {
    return []
  }
}

export default function App() {
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('api_url') || DEFAULT_API_URL)
  const [activeMenu, setActiveMenu] = useState('preventivo')
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [excelFile, setExcelFile] = useState(null)
  const [driveUrl, setDriveUrl] = useState('')
  const [csvText, setCsvText] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [localMode, setLocalMode] = useState(false)

  const [cliente, setCliente] = useState('')
  const [oggetto, setOggetto] = useState('')
  const [descrizioneLavoro, setDescrizioneLavoro] = useState('')
  const [suggested, setSuggested] = useState([])
  const [quantitaById, setQuantitaById] = useState({})
  const [quoteResult, setQuoteResult] = useState(null)

  const persistLocalItems = (nextItems) => {
    localStorage.setItem('local_pricelist_items', JSON.stringify(nextItems))
    setItems(nextItems)
    setLocalMode(true)
  }

  useEffect(() => {
    localStorage.setItem('api_url', apiUrl)
  }, [apiUrl])

  async function fetchItems(term = '') {
    if (localMode) {
      const localItems = loadLocalItems()
      const filtered = term
        ? localItems.filter((it) => `${it.codice_prezzo} ${it.capitolo} ${it.descrizione}`.toLowerCase().includes(term.toLowerCase()))
        : localItems
      setItems(filtered)
      return
    }

    const query = term ? `?search=${encodeURIComponent(term)}` : ''
    try {
      const res = await fetch(`${apiUrl}/pricelist/items${query}`)
      setItems(await res.json())
    } catch {
      const localItems = loadLocalItems()
      setItems(localItems)
      setLocalMode(true)
      setUploadMessage('API non raggiungibile: modalità locale attivata (salvataggio nel browser).')
    }
  }

  useEffect(() => {
    fetchItems()
  }, [apiUrl, localMode])

  async function saveItem(event) {
    event.preventDefault()
    setLoading(true)
    try {
      if (localMode) {
        const next = [{ id: Date.now(), ...form, prezzo_unitario: Number(form.prezzo_unitario) }, ...loadLocalItems()]
        persistLocalItems(next)
        setForm(emptyForm)
        return
      }

      await fetch(`${apiUrl}/pricelist/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, prezzo_unitario: Number(form.prezzo_unitario) })
      })
      setForm(emptyForm)
      await fetchItems(search)
    } finally {
      setLoading(false)
    }
  }

  async function uploadExcel(event) {
    event.preventDefault()
    if (!excelFile) {
      setUploadMessage('Seleziona prima un file Excel.')
      return
    }

    setUploading(true)
    setUploadMessage('')
    try {
      const body = new FormData()
      body.append('file', excelFile)

      const res = await fetch(`${apiUrl}/pricelist/upload`, {
        method: 'POST',
        body
      })

      if (!res.ok) {
        let detail = 'upload non riuscito'
        try {
          const err = await res.json()
          detail = err.detail ?? detail
        } catch {
          detail = await res.text()
        }
        setUploadMessage(`Errore upload: ${detail}`)
        return
      }

      const data = await res.json()
      setUploadMessage(`Upload completato ✅ Righe lette: ${data.total_rows}, inserite: ${data.inserted}, saltate: ${data.skipped}`)
      setExcelFile(null)
      await fetchItems(search)
    } catch {
      setUploadMessage(`Errore di connessione API (${apiUrl}).`) 
    } finally {
      setUploading(false)
    }
  }

  async function uploadFromDriveLink(event) {
    event.preventDefault()
    if (!driveUrl.trim()) {
      setUploadMessage('Inserisci un link Google Drive valido.')
      return
    }

    setUploading(true)
    setUploadMessage('')
    try {
      const res = await fetch(`${apiUrl}/pricelist/upload-from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: driveUrl.trim() })
      })

      if (!res.ok) {
        let detail = 'import da link non riuscito'
        try {
          const err = await res.json()
          detail = err.detail ?? detail
        } catch {
          detail = await res.text()
        }
        setUploadMessage(`Errore import link: ${detail}`)
        return
      }

      const data = await res.json()
      setUploadMessage(`Import da link completato ✅ Righe lette: ${data.total_rows}, inserite: ${data.inserted}, saltate: ${data.skipped}`)
      await fetchItems(search)
    } catch {
      setUploadMessage(`Errore di connessione API (${apiUrl}).`)
    } finally {
      setUploading(false)
    }
  }

  function importCsvTextLocal(event) {
    event.preventDefault()
    const lines = csvText.split('\n').map((line) => line.trim()).filter(Boolean)
    const parsed = []

    for (const line of lines) {
      const [codice_prezzo, capitolo, descrizione, unita_misura, prezzo_raw] = line.split(';').map((x) => x?.trim())
      const prezzo_unitario = Number((prezzo_raw || '').replace(',', '.'))
      if (!codice_prezzo || !descrizione || Number.isNaN(prezzo_unitario)) continue
      parsed.push({ id: Date.now() + parsed.length, codice_prezzo, capitolo: capitolo || 'N/D', descrizione, unita_misura: unita_misura || 'ora', prezzo_unitario })
    }

    if (!parsed.length) {
      setUploadMessage('Nessuna riga valida nel testo CSV. Formato: codice;capitolo;descrizione;unita_misura;prezzo')
      return
    }

    persistLocalItems([...parsed, ...loadLocalItems()])
    setCsvText('')
    setUploadMessage(`Import locale completato ✅ Inserite ${parsed.length} voci nel browser.`)
  }

  async function suggestItems() {
    if (localMode) {
      const tokens = descrizioneLavoro.toLowerCase().split(' ').filter(Boolean)
      const ranked = [...loadLocalItems()].sort((a, b) => {
        const aHay = `${a.descrizione} ${a.capitolo} ${a.codice_prezzo}`.toLowerCase()
        const bHay = `${b.descrizione} ${b.capitolo} ${b.codice_prezzo}`.toLowerCase()
        const aScore = tokens.filter((t) => aHay.includes(t)).length
        const bScore = tokens.filter((t) => bHay.includes(t)).length
        return bScore - aScore
      })
      setSuggested(ranked.slice(0, 5))
      return
    }

    const res = await fetch(`${apiUrl}/quotes/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descrizione_lavoro: descrizioneLavoro, top_k: 5 })
    })
    setSuggested(await res.json())
  }

  async function createQuote() {
    const righe = Object.entries(quantitaById)
      .filter(([, q]) => Number(q) > 0)
      .map(([item_id, quantita]) => ({ item_id: Number(item_id), quantita: Number(quantita) }))

    if (localMode) {
      const index = new Map(items.map((it) => [it.id, it]))
      const total = righe.reduce((acc, r) => acc + (index.get(r.item_id)?.prezzo_unitario || 0) * r.quantita, 0)
      setQuoteResult({ id: 'LOCAL', cliente, oggetto, totale: total })
      return
    }

    const res = await fetch(`${apiUrl}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, oggetto, descrizione_lavoro: descrizioneLavoro, righe })
    })
    setQuoteResult(await res.json())
  }

  const totalPreview = useMemo(() => suggested.reduce((acc, item) => acc + Number(quantitaById[item.id] || 0) * item.prezzo_unitario, 0), [suggested, quantitaById])

  return (
    <main>
      <h1>Assoverde • Preventivi con suggerimenti</h1>

      <section>
        <h2>Configurazione API backend</h2>
        <div className="grid">
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://tuo-backend.example.com" />
          <p className="hint">Imposta qui l'URL del backend FastAPI (in locale: <code>http://localhost:8000</code>).</p>
          {localMode && <p className="hint"><strong>Modalità locale attiva:</strong> i dati sono salvati nel browser.</p>}
        </div>
      </section>

      <nav className="menu">
        <button className={activeMenu === 'preventivo' ? 'active' : ''} onClick={() => setActiveMenu('preventivo')}>Preventivo</button>
        <button className={activeMenu === 'prezzario' ? 'active' : ''} onClick={() => setActiveMenu('prezzario')}>Prezzario</button>
      </nav>

      <section>
        <h2>1) Nuova voce prezzario</h2>
        <form onSubmit={saveItem} className="grid">
          <input placeholder="Codice prezzo" value={form.codice_prezzo} onChange={(e) => setForm({ ...form, codice_prezzo: e.target.value })} required />
          <input placeholder="Capitolo" value={form.capitolo} onChange={(e) => setForm({ ...form, capitolo: e.target.value })} required />
          <input placeholder="Descrizione" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} required />
          <input placeholder="Unità misura" value={form.unita_misura} onChange={(e) => setForm({ ...form, unita_misura: e.target.value })} required />
          <input placeholder="Prezzo unitario" type="number" step="0.01" min="0" value={form.prezzo_unitario} onChange={(e) => setForm({ ...form, prezzo_unitario: e.target.value })} required />
          <button disabled={loading}>{loading ? 'Salvataggio...' : 'Aggiungi voce'}</button>
        </form>

        <h3>Upload prezzario da Excel</h3>
        <form onSubmit={uploadExcel} className="grid upload-box">
          <input type="file" accept=".xlsx,.xlsm,.xltx,.xltm" onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)} />
          <button type="submit" disabled={!excelFile || uploading}>{uploading ? 'Caricamento in corso...' : 'Carica file Excel'}</button>
          <p className="hint"><strong>API:</strong> {apiUrl}</p>
          <p className="hint">Colonne richieste: <code>codice_prezzo</code>, <code>capitolo</code>, <code>descrizione</code>, <code>unita_misura</code>, <code>prezzo_unitario</code></p>
          {uploadMessage && <p><strong>{uploadMessage}</strong></p>}
        </form>

        <h3>Oppure importa da Google Drive (file)</h3>
        <form onSubmit={uploadFromDriveLink} className="grid upload-box">
          <input placeholder="Incolla link condivisibile Google Drive del file Excel" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} />
          <button type="submit" disabled={uploading}>{uploading ? 'Importazione in corso...' : 'Importa da link Drive'}</button>
          <p className="hint">Nota: il link deve essere del file, non della cartella.</p>
        </form>

        <h3>Altro modo: incolla CSV in locale</h3>
        <form onSubmit={importCsvTextLocal} className="grid upload-box">
          <textarea rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="codice;capitolo;descrizione;unita_misura;prezzo_unitario" />
          <button type="submit">Importa CSV in locale</button>
          <p className="hint">Se API non funziona, puoi caricare i dati nel browser con formato separato da ;</p>
        </form>
      </section>

      {activeMenu === 'prezzario' && (
        <section>
          <h2>Menu Prezzario • Voci elencate</h2>
          <input placeholder="Cerca per codice/capitolo/descrizione" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={() => fetchItems(search)}>Cerca</button>
          <p><strong>Totale voci trovate:</strong> {items.length}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Codice</th><th>Capitolo</th><th>Descrizione</th><th>UM</th><th>Prezzo</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.codice_prezzo}</td><td>{item.capitolo}</td><td>{item.descrizione}</td><td>{item.unita_misura}</td><td>€ {item.prezzo_unitario.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeMenu === 'preventivo' && (
        <section>
          <h2>2) Nuovo preventivo</h2>
          <div className="grid">
            <input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            <input placeholder="Oggetto" value={oggetto} onChange={(e) => setOggetto(e.target.value)} />
            <textarea placeholder="Descrizione del lavoro" value={descrizioneLavoro} onChange={(e) => setDescrizioneLavoro(e.target.value)} />
            <button onClick={suggestItems}>Suggerisci voci</button>
          </div>

          <h3>Voci suggerite</h3>
          <ul>
            {suggested.map((item) => (
              <li key={item.id}>
                {item.descrizione} — € {item.prezzo_unitario.toFixed(2)} / {item.unita_misura}
                <input type="number" min="0" step="0.5" placeholder="Quantità" value={quantitaById[item.id] || ''} onChange={(e) => setQuantitaById({ ...quantitaById, [item.id]: e.target.value })} />
              </li>
            ))}
          </ul>

          <p><strong>Anteprima totale:</strong> € {totalPreview.toFixed(2)}</p>
          <button onClick={createQuote}>Crea preventivo</button>

          {quoteResult && (
            <article>
              <h3>Preventivo #{quoteResult.id}</h3>
              <p><strong>Cliente:</strong> {quoteResult.cliente}</p>
              <p><strong>Oggetto:</strong> {quoteResult.oggetto}</p>
              <p><strong>Totale:</strong> € {quoteResult.totale.toFixed(2)}</p>
            </article>
          )}
        </section>
      )}
    </main>
  )
}
