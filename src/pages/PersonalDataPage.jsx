import { useState, useEffect } from 'react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts'
import './PersonalDataPage.css'

function PersonalDataPage({ formData, onGoHome, onSwitchTab }) {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [error, setError] = useState(null)
  
  // Grafiek states
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [chartData, setChartData] = useState([])
  const [showChart, setShowChart] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)
  const [selectedMonthTotal, setSelectedMonthTotal] = useState(0)

  // Hourly usage states
  const [selectedMonthHourly, setSelectedMonthHourly] = useState(new Date().getMonth() + 1)
  const [hourlyChartData, setHourlyChartData] = useState([])
  const [showHourlyChart, setShowHourlyChart] = useState(false)
  const [loadingHourlyChart, setLoadingHourlyChart] = useState(false)

  // Initialisatie van data
  useEffect(() => {
    if (!formData?.smartMeterData) {
      setError('Geen slimme meter data beschikbaar. Upload eerst een bestand.')
      return
    }
    setAnalyticsData(formData)
  }, [formData])

  // Effect om grafiek data op te halen
  useEffect(() => {
    if (showChart && analyticsData) {
      fetchDailyData(selectedMonth)
    }
  }, [selectedMonth, showChart, analyticsData])

  const fetchDailyData = async (month) => {
    setLoadingChart(true)
    try {
      const response = await fetch('http://localhost:5001/api/monthly-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: month })
      })
      const data = await response.json()
      const totaalMaand = data.reduce((acc, dag) => acc + (dag.verbruik || 0), 0)
      setChartData(data)
      setSelectedMonthTotal(totaalMaand)
    } catch (err) {
      console.error("Fout bij ophalen grafiekdata:", err)
    } finally {
      setLoadingChart(false)
    }
  }

  // Effect om uurgrafiek data op te halen
  useEffect(() => {
    if (showHourlyChart && analyticsData) {
      fetchHourlyData(selectedMonthHourly)
    }
  }, [selectedMonthHourly, showHourlyChart, analyticsData])

  const fetchHourlyData = async (month) => {
    setLoadingHourlyChart(true)
    try {
      const response = await fetch('http://localhost:5001/api/hourly-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: month })
      })
      const data = await response.json()
      setHourlyChartData(data)
    } catch (err) {
      console.error("Fout bij ophalen uurgrafiekdata:", err)
    } finally {
      setLoadingHourlyChart(false)
    }
  }

  // Loading/Empty State
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

  // Variabelen definiëren
  const summary = analyticsData.smartMeterData || {}
  const hourlyData = analyticsData.hourlyAnalytics || {}
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

  const maanden = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"]

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

        {/* Key Metrics Grid - Schoon en hersteld */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">📈</div>
            <div className="metric-content">
              <p className="metric-label">Gem. Dagelijks</p>
              <p className="metric-value">{avgDaily.toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>

          <div 
            className={`metric-card clickable ${showChart ? 'active' : ''}`} 
            onClick={() => setShowChart(!showChart)}
            title="Klik om maandgrafiek te tonen"
          >
            <div className="metric-icon">📅</div>
            <div className="metric-content">
              <p className="metric-label">
                {showChart ? `Totaal ${maanden[selectedMonth - 1]}` : 'Gem. Maandelijks'} {showChart ? '▲' : '▼'}
              </p>
              <p className="metric-value">
                {showChart && chartData.length > 0 
                  ? chartData.reduce((acc, curr) => acc + (curr.verbruik || 0), 0).toFixed(2) 
                  : monthlyConsumption.toFixed(2) 
                } 
                <span className="unit"> kWh</span>
              </p>
            </div>
          </div>

          <div 
            className={`metric-card clickable ${showHourlyChart ? 'active' : ''}`} 
            onClick={() => setShowHourlyChart(!showHourlyChart)}
            title="Klik om uurgrafiek te tonen"
          >
            <div className="metric-icon">⏰</div>
            <div className="metric-content">
              <p className="metric-label">Dagelijks Gebruik {showHourlyChart ? '▲' : '▼'}</p>
              <p className="metric-value">Per Uur</p>
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
        </div>

        {/* Interactieve Grafiek Sectie - Dagelijks */}
        {showChart && (
          <div className="chart-container-wrapper">
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="chart-title-group">
                <h3 style={{ margin: 0 }}>Verbruik per dag in detail</h3>
                {!loadingChart && chartData.length > 0 && (
                  <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#96c63e', fontWeight: 'bold' }}>
                    Totaal {maanden[selectedMonth - 1]}: {chartData.reduce((acc, curr) => acc + (curr.verbruik || 0), 0).toFixed(2)} kWh
                  </p>
                )}
              </div>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="month-select"
              >
                {maanden.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
            </div>

            {loadingChart ? (
              <div className="chart-loading">Data ophalen...</div>
            ) : (
              <div className="chart-holder">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#96c63e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#96c63e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorReturn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2196F3" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#2196F3" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis unit="kWh" />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="verbruik" stroke="#96c63e" fill="url(#colorUsage)" name="Verbruik (kWh)" />
                    <Area type="monotone" dataKey="teruglevering" stroke="#2196F3" fill="url(#colorReturn)" name="Teruglevering (kWh)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Interactieve Grafiek Sectie - Uurlijks */}
        {showHourlyChart && (
          <div className="chart-container-wrapper">
            <div className="chart-header">
              <h3>Verbruik per uur in detail</h3>
              <select 
                value={selectedMonthHourly} 
                onChange={(e) => setSelectedMonthHourly(parseInt(e.target.value))}
                className="month-select"
              >
                {maanden.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
            </div>
            {loadingHourlyChart ? (
              <div className="chart-loading">Data ophalen...</div>
            ) : (
              <div className="chart-holder">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={hourlyChartData}>
                    <defs>
                      <linearGradient id="colorHourly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff9800" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ff9800" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hour" />
                    <YAxis unit="kWh" />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="verbruik" stroke="#ff9800" fill="url(#colorHourly)" name="Verbruik (kWh)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        <div className="info-box">
          <div className="info-icon">💡</div>
          <div className="info-content">
            <h3>Inzicht in Jouw Verbruik</h3>
            <p>
              Je hoogste verbruik vindt meestal plaats rond <strong>{peakHour}:00 uur</strong>. 
              Het meest gunstige moment voor grootverbruik is rond <strong>{lowestHour}:00 uur</strong>.
            </p>
          </div>
        </div>

        <table className="stats-table">
          <thead>
            <tr><th>Statistiek</th><th>Waarde</th></tr>
          </thead>
          <tbody>
            <tr><td>Gemiddeld dagelijks verbruik</td><td className="value">{avgDaily.toFixed(2)} kWh</td></tr>
            <tr className="highlight"><td><strong>Totaal periode verbruik</strong></td><td className="value"><strong>{totalConsumption.toFixed(2)} kWh</strong></td></tr>
          </tbody>
        </table>

        <div className="action-buttons">
          <button className="compare-btn" onClick={onSwitchTab}>⚖️ Vergelijk Contracten</button>
          <button className="new-file-btn" onClick={onGoHome}>📤 Nieuw Bestand</button>
        </div>
      </div>
    </div>
  )
}
export default PersonalDataPage