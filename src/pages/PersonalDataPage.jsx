import { useState, useEffect } from 'react'
import './PersonalDataPage.css'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts'

function PersonalDataPage() {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dailyData, setDailyData] = useState([])
  const [hourlyChartData, setHourlyChartData] = useState([])
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [showChart, setShowChart] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)

  const [selectedMonthHourly, setSelectedMonthHourly] = useState(new Date().getMonth() + 1)
  const [showHourlyChart, setShowHourlyChart] = useState(false)
  const [loadingHourlyChart, setLoadingHourlyChart] = useState(false)

  // Initial data fetch
  useEffect(() => {
    const fetchMainData = async () => {
      try {
        setLoading(true)
        const res = await fetch(`http://127.0.0.1:5001/api/load-local-data`)
        if (!res.ok) throw new Error(`Server fout (Status: ${res.status})`)
        const data = await res.json()
        setAnalyticsData(data)
        
        if (data.smartMeterData?.date_range_start) {
          const firstMonth = new Date(data.smartMeterData.date_range_start).getMonth() + 1
          setSelectedMonth(firstMonth)
          setSelectedMonthHourly(firstMonth)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchMainData()
  }, [])

  useEffect(() => {
    if (!showChart) return
    const fetchDailyDetails = async () => {
      setLoadingChart(true)
      try {
        const res = await fetch(`http://127.0.0.1:5001/api/month-detail/${selectedMonth}`)
        const data = await res.json()
        
        if (Array.isArray(data)) {
          const cleanedData = data.map(item => ({
            ...item,
            verbruik: Math.max(0, item.verbruik || 0),
            teruglevering: Math.abs(item.teruglevering || 0) < 0.001 ? 0 : Math.abs(item.teruglevering)
          }))
          setDailyData(cleanedData)
        } else {
          setDailyData([])
        }
      } catch (err) {
        console.error("Fout bij ophalen maanddata:", err)
        setDailyData([])
      } finally {
        setLoadingChart(false)
      }
    }
    fetchDailyDetails()
  }, [selectedMonth, showChart])

  useEffect(() => {
    if (!showHourlyChart) return
    const fetchHourly = async () => {
      setLoadingHourlyChart(true)
      try {
        const res = await fetch(`http://127.0.0.1:5001/api/hourly-detail/${selectedMonthHourly}`)
        const data = await res.json()
        
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const chartArray = Object.keys(data).map(hourKey => ({
            hour: parseInt(hourKey),
            verbruik: data[hourKey].verbruik || 0,
            teruglevering: Math.abs(data[hourKey].teruglevering || 0)
          }));

          chartArray.sort((a, b) => a.hour - b.hour);
          
          setHourlyChartData(chartArray);
        } else if (Array.isArray(data)) {
          setHourlyChartData(data);
        }
      } catch (err) {
        console.error("Fout bij laden uurgegevens:", err)
      } finally {
        setLoadingHourlyChart(false)
      }
    }
    fetchHourly()
  }, [selectedMonthHourly, showHourlyChart])

  if (loading) return <div className="personal-data-page"><div className="empty-state"><h2>Laden...</h2></div></div>
  if (error) return <div className="personal-data-page"><div className="empty-state"><h2>Fout: {error}</h2></div></div>
  if (!analyticsData) return null

  const summary = analyticsData.smartMeterData || {}
  const hourlyDataMap = analyticsData.hourly_analytics || {} 
  const maanden = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"]

  const hours = Object.keys(hourlyDataMap);

  // 1. Hoogste verbruik: waar is 'verbruik' het grootst?
  const peakHour = hours.length > 0 
    ? hours.reduce((a, b) => (
        (hourlyDataMap[a]?.verbruik || 0) > (hourlyDataMap[b]?.verbruik || 0) ? a : b
      )) 
    : "00";

  // 2. Gunstigste moment: waar is de (absolute) teruglevering het hoogst?
  const bestHour = hours.length > 0 
    ? hours.reduce((a, b) => (
        Math.abs(hourlyDataMap[a]?.teruglevering || 0) > Math.abs(hourlyDataMap[b]?.teruglevering || 0) ? a : b
      )) 
    : "00";

  return (
    <div className="personal-data-page">
      <div className="personal-container">
        <div className="header">
          <h1>Energieprofiel</h1>
          <p className="subtitle">Data van {summary?.date_range_start?.split('T')[0]} tot {summary?.date_range_end?.split('T')[0]}</p>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">
              <img 
                src="/images/icons/Monitor-Heart-Rate-1--Streamline-Ultimate.png" 
                alt="Hartslag monitor" 
                style={{ width: '24px', height: '24px' }} 
              />
            </div>
            <div className="metric-content">
              <p className="metric-label">Gemiddelde Dagelijks</p>
              <p className="metric-value">{(summary.average_daily_consumption || 0).toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>

          <div className={`metric-card clickable ${showChart ? 'active' : ''}`} onClick={() => setShowChart(!showChart)}>
            <div className="metric-icon">
              <img 
                src="/images/icons/Time-Monthly-2--Streamline-Ultimate.png" 
                alt="Hartslag monitor" 
                style={{ width: '24px', height: '24px' }} 
              />
            </div>
            <div className="metric-content">
              <p className="metric-label">Maandoverzicht</p>
              <p className="metric-value">{(analyticsData.summary?.monthlyConsumption || 0).toFixed(2)} <span className="unit">kWh</span></p>
            </div>
          </div>

          <div className={`metric-card clickable ${showHourlyChart ? 'active' : ''}`} onClick={() => setShowHourlyChart(!showHourlyChart)}>
            <div className="metric-icon">
              <img 
                src="/images/icons/Time-Clock-Circle--Streamline-Ultimate.png" 
                alt="Hartslag monitor" 
                style={{ width: '24px', height: '24px' }} 
              />
            </div>
            <div className="metric-content">
              <p className="metric-label">Uurdetails</p>
              <p className="metric-value">Bekijken</p>
            </div>
          </div>

          <div className="metric-card-return-card">
            <div className="metric-icon">
              <img 
                src="/images/icons/Weather-Sun--Streamline-Ultimate.png" 
                alt="Hartslag monitor" 
                style={{ width: '24px', height: '24px' }} 
              />
            </div>
            <div className="metric-content">
              <p className="metric-label">Teruglevering</p>
              <p className="metric-value">{(summary.total_returned_kwh || 0).toFixed(2)} <span className="return">kWh</span></p>
            </div>
          </div>
        </div>

        {showChart && (
          <div className="chart-container-wrapper" style={{ height: '450px', minHeight: '450px', display: 'block' }}>
            <div className="chart-header">
              <h3>Verbruik en Teruglevering per dag</h3>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))} 
                className="month-select"
              >
                {maanden.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            
            {loadingChart ? (
              <div className="loading-state">Data ophalen...</div>
            ) : (
              <div style={{ width: '100%', height: '350px', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={dailyData} 
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis 
                      dataKey="day" 
                      type="category" 
                      tick={{fill: '#666', fontSize: 12}}
                    />
                    <YAxis 
                      width={50}
                      domain={['auto', 'auto']} 
                      allowDataOverflow={true}
                      tick={{fill: '#666', fontSize: 12}}
                      tickFormatter={(val) => val.toFixed(1)}
                    />
                    <Tooltip />
                    <Legend 
                      verticalAlign="top" 
                      height={40} 
                      formatter={(value) => (
                        <span style={{ 
                          fontFamily: 'Mulish, sans-serif', 
                          fontWeight: 200,      // 200 is 'Extra Light' voor Mulish
                          fontSize: '14px',
                          color: '#666'         // Optioneel: pas hier de tekstkleur aan
                        }}>
                          {value}
                        </span>
                      )} 
                    />

                    {/* Verbruik: Groen - baseValue 0 is cruciaal voor de spiegel-look */}
                    <Area 
                      name="Verbruik"
                      type="monotone" 
                      dataKey="verbruik" 
                      stroke="var(--benext-green)" 
                      fill="var(--benext-lightgreen)" 
                      fillOpacity={0.4} 
                      baseValue={0}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    
                    {/* Teruglevering: Blauw - baseValue 0 laat hem omlaag groeien */}
                    <Area 
                      name="Teruglevering" 
                      type="monotone" 
                      dataKey="teruglevering" 
                      stroke="var(--benext-darkorange)" 
                      fill="var(--benext-orange)" 
                      fillOpacity={0.4} 
                      baseValue={0}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {showHourlyChart && (
          <div className="chart-container-wrapper" style={{ height: '450px', width: '100%', marginBottom: '20px' }}>
            <div className="chart-header">
              <h3>Gemiddeld verbruik per uur</h3>
              <select 
                value={selectedMonthHourly} 
                onChange={(e) => setSelectedMonthHourly(parseInt(e.target.value))} 
                className="month-select"
              >
                {maanden.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>

            {loadingHourlyChart ? (
              <div className="loading-state">Uurdata ophalen...</div>
            ) : (
              <div style={{ width: '100%', height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(t) => `${t}:00`} 
                      tick={{fill: '#666', fontSize: 12}}
                    />
                    <YAxis 
                      tick={{fill: '#666', fontSize: 12}}
                      domain={[0, 'auto']} 
                    />
                    <Tooltip labelFormatter={(t) => `Tijdstip: ${t}:00`} />
                    <Legend 
                        verticalAlign="top" 
                        height={40} 
                        formatter={(value) => (
                          <span style={{ 
                            fontFamily: 'Mulish, sans-serif', 
                            fontWeight: 200,      
                            fontSize: '14px',
                            color: '#666'        
                          }}>
                            {value}
                          </span>
                        )} 
                      />
                    
                    <Area 
                      name="Gemiddelde Verbruik" 
                      type="monotone" 
                      dataKey="verbruik" 
                      stroke="var(--benext-green)" 
                      fill="var(--benext-lightgreen)" 
                      fillOpacity={0.4} 
                    />
                    <Area 
                      name="Gemiddelde Teruglevering" 
                      type="monotone" 
                      dataKey="teruglevering" 
                      stroke="var(--benext-darkorange)" 
                      fill="var(--benext-orange)" 
                      fillOpacity={0.4} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        <div className="info-box">
          <div className="metric-icon">
              <img 
                src="/images/icons/Weather-Sun--Streamline-Ultimate.png" 
                alt="Hartslag monitor" 
                style={{ width: '24px', height: '24px' }} 
              />
            </div>
          <div className="info-content">
            <h3>Inzicht</h3>
            <p>Hoogste verbruik: <strong>{peakHour}:00 uur</strong>. Gunstigste moment: <strong>{bestHour}:00 uur</strong>.</p>
          </div>
        </div>

        <div className="action-buttons">
          <button className="compare-btn" onClick={() => window.location.href = '/compare'}>
            <div className="metric-icon">
              <img 
                src="/images/icons/Legal-Scale-1--Streamline-Ultimate.png" 
                alt="Hartslag monitor" 
                style={{ width: '24px', height: '24px' }} 
              />
            </div>
             <h4>Vergelijk Contracten</h4></button>
        </div>
      </div>
    </div>
  )
}

export default PersonalDataPage