import { useEffect, useMemo, useState } from 'react'

const API_URL = 'http://localhost:8000'

const emptyForm = {
  codice_prezzo: '',
  capitolo: 'NOLEGGI',
  descrizione: '',
  unita_misura: 'ora',
  prezzo_unitario: ''
}

export default function App() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const [cliente, setCliente] = useState('')
  const [oggetto, setOggetto] = useState('')
  const [descrizioneLavoro, setDescrizioneLavoro] = useState('')
  const [suggested, setSuggested] = useState([])
  const [quantitaById, setQuantitaById] = useState({})
  const [quoteResult, setQuoteResult] = useState(null)

  async function fetchItems(term = '') {
    const query = term ? `?search=${encodeURIComponent(term)}` : ''
    const res = await fetch(`${API_URL}/pricelist/items${query}`)
    setItems(await res.json())
  }

  useEffect(() => {
    fetchItems()
  }, [])

  async function saveItem(event) {
    event.preventDefault()
    setLoading(true)
    try {
      await fetch(`${API_URL}/pricelist/items`, {
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

  async function suggestItems() {
    const res = await fetch(`${API_URL}/quotes/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descrizione_lavoro: descrizioneLavoro, top_k: 5 })
    })
    const data = await res.json()
    setSuggested(data)
  }

  async function createQuote() {
    const righe = Object.entries(quantitaById)
      .filter(([, q]) => Number(q) > 0)
      .map(([item_id, quantita]) => ({ item_id: Number(item_id), quantita: Number(quantita) }))

    const res = await fetch(`${API_URL}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente,
        oggetto,
        descrizione_lavoro: descrizioneLavoro,
        righe
      })
    })

    setQuoteResult(await res.json())
  }

  const totalPreview = useMemo(() => {
    return suggested.reduce((acc, item) => {
      const q = Number(quantitaById[item.id] || 0)
      return acc + q * item.prezzo_unitario
    }, 0)
  }, [suggested, quantitaById])

  return (
    <main>
      <h1>Assoverde • Preventivi con suggerimenti</h1>

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
      </section>

      <section>
        <h2>Prezzario</h2>
        <input
          placeholder="Cerca per codice/capitolo/descrizione"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => fetchItems(search)}>Cerca</button>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.codice_prezzo}</strong> — {item.descrizione} ({item.unita_misura}) • € {item.prezzo_unitario.toFixed(2)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>2) Nuovo preventivo</h2>
        <div className="grid">
          <input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input placeholder="Oggetto" value={oggetto} onChange={(e) => setOggetto(e.target.value)} />
          <textarea
            placeholder="Descrizione del lavoro"
            value={descrizioneLavoro}
            onChange={(e) => setDescrizioneLavoro(e.target.value)}
          />
          <button onClick={suggestItems}>Suggerisci voci</button>
        </div>

        <h3>Voci suggerite</h3>
        <ul>
          {suggested.map((item) => (
            <li key={item.id}>
              {item.descrizione} — € {item.prezzo_unitario.toFixed(2)} / {item.unita_misura}
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="Quantità"
                value={quantitaById[item.id] || ''}
                onChange={(e) => setQuantitaById({ ...quantitaById, [item.id]: e.target.value })}
              />
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
    </main>
  )
}
