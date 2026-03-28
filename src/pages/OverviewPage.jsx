import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import './ComparePage.css'

function OverviewPage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rowCount, setRowCount] = useState(0)

  useEffect(() => {
    const sourcePaths = [
      '/backend/uploads/combined_data.csv',
      'http://localhost:5001/uploads/combined_data.csv',
      'http://127.0.0.1:5001/uploads/combined_data.csv'
    ]

    const fetchCsv = async () => {
      setLoading(true)
      setError(null)

      for (const path of sourcePaths) {
        try {
          const res = await fetch(path)
          if (!res.ok) {
            if (res.status === 404) {
              continue // try next path
            }
            throw new Error(`Kan CSV niet laden: ${res.status} ${res.statusText}`)
          }

          const text = await res.text()
          if (!text.trim()) {
            setError('CSV is leeg (geen inhoud).')
            setRecords([])
            setRowCount(0)
            return
          }

          const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
          })

          if (parsed.errors && parsed.errors.length > 0) {
            console.error('CSV parse errors', parsed.errors)
            setError('CSV parsing fout: controleer bestandsschema.')
            setRecords([])
            setRowCount(0)
            return
          }

          const data = parsed.data || []
          if (data.length === 0) {
            setError('CSV bevat geen rijen.')
            setRecords([])
            setRowCount(0)
            return
          }

          setRecords(data)
          setRowCount(data.length)
          setError(null)
          return
        } catch (e) {
          console.warn(`CSV-fetch mislukt voor ${path}:`, e)
          // blijf proberen met volgende path
        }
      }

      setError('Het CSV-bestand kon niet worden gevonden of geladen. Controleer backend/uploads/combined_data.csv')
      setRecords([])
      setRowCount(0)
      setLoading(false)
    }

    fetchCsv().finally(() => setLoading(false))
  }, [])

  const renderOverview = () => {
    if (loading) {
      return <p>Gegevens laden...</p>
    }

    if (error) {
      return <p className="error-text">{error}</p>
    }

    const sample = records[0] || {}
    const keys = Object.keys(sample)

    return (
      <div>
        <p>CSV laad succesvol uit <code>backend/uploads/combined_data.csv</code>.</p>
        <p>Rijen: <strong>{rowCount}</strong></p>

        <h3>Kolommen</h3>
        {keys.length ? (
          <ul>
            {keys.map(k => <li key={k}>{k}</li>)}
          </ul>
        ) : (
          <p>Lege CSV-structuur</p>
        )}

        <h3>Voorbeeldgegevens</h3>
        <pre style={{ maxHeight: 240, overflow: 'auto', background: '#f4f4f4', padding: '0.7rem' }}>
          {JSON.stringify(records.slice(0, 5), null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className="overview-page">
      <div className="container">
        <header className="header">
          <h1>Overview</h1>
          <p>Data uit backend/uploads/combined_data.csv</p>
        </header>

        {renderOverview()}

        {error && (
          <div className="error-message" style={{ marginTop: 20 }}>
            Mogelijk ontbreekt of is de CSV leeg. Controleer de backend uploadmap.
          </div>
        )}
      </div>
    </div>
  )
}

export default OverviewPage
