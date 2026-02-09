import { useState, useEffect } from 'react'
import './PersonalDataPage.css'

function PersonalDataPage({ formData, onGoHome, onSwitchTab }) {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!formData?.smartMeterData) {
      setError('Geen slimme meter data beschikbaar. Upload eerst een bestand.')
      return
    }
    // Data is already available from HomePage processing
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
            <p>Upload een slimme meter bestand om je persoonlijke energiegegevens te zien.</p>
            <button className="upload-btn" onClick={onGoHome}>Bestand Uploaden</button>
          </div>
        </div>
      </div>
    )
  }

  const summary = analyticsData.smartMeterData
  const avgConsumption = summary?.average_daily_consumption || 0
  const totalConsumption = summary?.total_consumption || 0
  const peakHour = analyticsData.peakHour || 'N/A'
  const lowestHour = analyticsData.lowestHour || 'N/A'

  return (
    <div className="personal-data-page">
      <div className="personal-container">
        <div className="header">
          <button className="back-btn" onClick={onGoHome}>← Terug</button>
          <h1>⚡ Jouw Energieverbruik Profiel</h1>
          <p className="subtitle">
            Periode: {summary?.date_range_start?.split('T')[0]} tot {summary?.date_range_end?.split('T')[0]}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">📋</div>
            <div className="metric-content">
              <p className="metric-label">Totaal Records</p>
              <p className="metric-value">{summary?.total_records}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">📈</div>
            <div className="metric-content">
              <p className="metric-label">Gem. Dagelijks</p>
              <p className="metric-value">{avgConsumption.toFixed(2)} <span className="unit">kWh</span></p>
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
              <p className="metric-value">{summary?.max_daily_consumption?.toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="info-box">
          <div className="info-icon">💡</div>
          <div className="info-content">
            <h3>Over Jouw Verbruik</h3>
            <p>
              Je dagelijks energieverbruik is gemiddeld <strong>{avgConsumption.toFixed(2)} kWh</strong>. 
              Het hoogste verbruik is meestal rond <strong>{peakHour}:00 uur</strong>. 
              Dit kan helpen bij het kiezen van een geschikt energiecontract.
            </p>
          </div>
        </div>

        {/* Stats Table */}
        <div className="stats-section">
          <h2>Verbruiksstatistieken</h2>
          <div className="stats-table-container">
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
                  <td className="value">{avgConsumption.toFixed(2)} kWh</td>
                </tr>
                <tr>
                  <td>Maximaal dagelijks verbruik</td>
                  <td className="value">{summary?.max_daily_consumption?.toFixed(2)} kWh</td>
                </tr>
                <tr>
                  <td>Minimaal dagelijks verbruik</td>
                  <td className="value">{summary?.min_daily_consumption?.toFixed(2)} kWh</td>
                </tr>
                <tr className="highlight">
                  <td><strong>Totaal periode verbruik</strong></td>
                  <td className="value"><strong>{totalConsumption.toFixed(2)} kWh</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="compare-btn" onClick={onSwitchTab}>
            ⚖️ Vergelijk Contracten
          </button>
          <button className="new-file-btn" onClick={onGoHome}>
            📤 Ander Bestand Uploaden
          </button>
        </div>
      </div>
    </div>
  )
}

export default PersonalDataPage
