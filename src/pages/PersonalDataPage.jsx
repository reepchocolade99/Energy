import { useState, useEffect } from 'react'
import './PersonalDataPage.css'

function PersonalDataPage({ formData, onGoHome, onSwitchTab }) {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [error, setError] = useState(null)

  // Initialisatie van data
  useEffect(() => {
    if (!formData?.smartMeterData) {
      setError('Geen slimme meter data beschikbaar. Upload eerst een bestand.')
      return
    }
    setAnalyticsData(formData)
  }, [formData])

  if (!analyticsData) {
    return (
      <div className="personal-data-page">
        <div className="container">
          <button className="back-btn" onClick={onGoHome}>← Terug</button>
          <div className="empty-state">
            <p className="empty-icon">📊</p>
            <h2>Geen Data Beschikbaar</h2>
            <p>{error || 'Gegevens laden...'}</p>
            <button className="upload-btn" onClick={onGoHome}>Bestand Uploaden</button>
          </div>
        </div>
      </div>
    )
  }

  // variabelen definiëren op basis van de gepushte analyticsData
  const summary = analyticsData.smartMeterData || {}
  const hourlyData = analyticsData.hourlyAnalytics || {}
  
  // Verbruikscijfers
  const avgDaily = summary.average_daily_consumption || 0
  const totalConsumption = summary.total_kwh || 0
  const monthlyConsumption = analyticsData.monthlyConsumption || 0

  // Logica voor Piek- en Laagste uur
  const hours = Object.keys(hourlyData)
  const peakHour = hours.length > 0 
    ? hours.reduce((a, b) => (hourlyData[a]?.diff > hourlyData[b]?.diff ? a : b)) 
    : "N/A"
  
  const lowestHour = hours.length > 0 
    ? hours.reduce((a, b) => (hourlyData[a]?.diff < hourlyData[b]?.diff ? a : b)) 
    : "N/A"

  return (
    <div className="personal-data-page">
      <div className="personal-container">
        <div className="header">
          <button className="back-btn" onClick={onGoHome}>← Terug</button>
          <h1>⚡ Jouw Energieverbruik Profiel</h1>
          <p className="subtitle">
            Periode: {summary?.date_range_start?.split(' ')[0]} tot {summary?.date_range_end?.split(' ')[0]}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">📈</div>
            <div className="metric-content">
              <p className="metric-label">Gem. Dagelijks</p>
              <p className="metric-value">{avgDaily.toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">📅</div>
            <div className="metric-content">
              <p className="metric-label">Gem. Maandelijks</p>
              <p className="metric-value">{monthlyConsumption.toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">⚡</div>
            <div className="metric-content">
              <p className="metric-label">Totaal Verbruik</p>
              <p className="metric-value">{totalConsumption.toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">🔴</div>
            <div className="metric-content">
              <p className="metric-label">Piekuur</p>
              <p className="metric-value">{peakHour}:00</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">🟢</div>
            <div className="metric-content">
              <p className="metric-label">Laagste Uur</p>
              <p className="metric-value">{lowestHour}:00</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">📊</div>
            <div className="metric-content">
              <p className="metric-label">Max. Dagelijks</p>
              <p className="metric-value">{summary?.max_daily_consumption?.toFixed(2) || '0.00'} <span className="unit">kWh</span></p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="info-box">
          <div className="info-icon">💡</div>
          <div className="info-content">
            <h3>Over Jouw Verbruik</h3>
            <p>
              Je gemiddelde verbruik per maand is <strong>{monthlyConsumption.toFixed(2)} kWh</strong>. 
              Dat komt neer op ongeveer <strong>{avgDaily.toFixed(2)} kWh</strong> per dag. 
              Het hoogste verbruik vindt plaats rond <strong>{peakHour}:00 uur</strong>.
            </p>
          </div>
        </div>

        <table className="stats-table">
          <thead>
            <tr>
              <th>Statistiek</th>
              <th>Waarde</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gemiddeld dagelijks verbruik</td>
              <td className="value">{avgDaily.toFixed(2)} kWh</td>
            </tr>
            <tr>
              <td>Gemiddeld maandelijks verbruik</td>
              <td className="value">{monthlyConsumption.toFixed(2)} kWh</td>
            </tr>
            <tr>
              <td>Maximaal dagelijks verbruik</td>
              <td className="value">{summary?.max_daily_consumption?.toFixed(2) || '0.00'} kWh</td>
            </tr>
            <tr>
              <td>Minimaal dagelijks verbruik</td>
              <td className="value">{summary?.min_daily_consumption?.toFixed(2) || '0.00'} kWh</td>
            </tr>
            <tr className="highlight">
              <td><strong>Totaal periode verbruik</strong></td>
              <td className="value"><strong>{totalConsumption.toFixed(2)} kWh</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="compare-btn" onClick={onSwitchTab}>
            ⚖️ Vergelijk Contracten
          </button>
          <button className="new-file-btn" onClick={onGoHome}>
            📤 Gegevens Bewerken
          </button>
        </div>
      </div>
    </div>
  )
}

export default PersonalDataPage