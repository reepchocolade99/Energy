import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import './PersonalDataPage.css'

function PersonalDataPage({ formData, onGoHome, onSwitchTab }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [chartData, setChartData] = useState([])
  const [showChart, setShowChart] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)

  const summary = formData?.smartMeterData || {}
  const monthlyConsumption = formData?.monthlyConsumption || 0

  // Effect om grafiekdata op te halen als de maand of zichtbaarheid verandert
  useEffect(() => {
    if (showChart) {
      fetchDailyData(selectedMonth)
    }
  }, [selectedMonth, showChart])

  const fetchDailyData = async (month) => {
    setLoadingChart(true)
    try {
      const response = await fetch('http://localhost:5001/api/monthly-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: month })
      })
      const data = await response.json()
      setChartData(data)
    } catch (err) {
      console.error("Fout bij ophalen grafiekdata:", err)
    } finally {
      setLoadingChart(false)
    }
  }

  return (
    <div className="personal-data-page">
      <div className="personal-container">
        <div className="header">
          <button className="back-btn" onClick={onGoHome}>← Terug</button>
          <h1>⚡ Jouw Energieverbruik Profiel</h1>
        </div>

        <div className="metrics-grid">
          {/* Klikbare Kaart: Maandelijks */}
          <div 
            className={`metric-card clickable ${showChart ? 'active' : ''}`} 
            onClick={() => {
            console.log("Kaart geklikt! Huidige status:", !showChart);
            setShowChart(!showChart);
          }}
          >
            <div className="metric-icon">📅</div>
            <div className="metric-content">
              <p className="metric-label">Gem. Maandelijks (Klik voor grafiek)</p>
              <p className="metric-value">{monthlyConsumption.toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">📈</div>
            <div className="metric-content">
              <p className="metric-label">Gem. Dagelijks</p>
              <p className="metric-value">{(summary.average_daily_consumption || 0).toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>
        </div>

        {/* Interactieve Grafiek Sectie */}
        {showChart && (
          <div className="chart-container-wrapper">
            <div className="chart-header">
              <h3>Verbruik per dag</h3>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="month-select"
              >
                {["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"].map((month, idx) => (
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
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis unit="kWh" />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="verbruik" 
                      stroke="#96c63e" 
                      fillOpacity={1} 
                      fill="url(#colorUsage)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ... Rest van je tabel en actieknoppen ... */}
      </div>
    </div>
  )
}