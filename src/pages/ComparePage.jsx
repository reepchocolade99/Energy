import { useState, useEffect } from 'react'
import './ComparePage.css'

function ComparePage({ formData, onGoHome }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/compare-contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            monthlyConsumption: formData?.monthlyConsumption || 0 
          })
        })
        const data = await response.json()
        setContracts(data)
        setLoading(false)
      } catch (error) {
        console.error("Fout bij ophalen contracten:", error)
        setLoading(false)
      }
    }

    fetchContracts()
  }, [formData])

  if (loading) return <div className="loading-container">Contracten vergelijken...</div>

  return (
    <div className="compare-page">
      <div className="compare-container">
        {/* Header met jouw groene stijl */}
        <header className="header">
          <button onClick={onGoHome} className="back-btn">← Terug naar start</button>
          <h1>Beste deals voor jou</h1>
          <p className="comparison-info">
            Op basis van <strong>{Math.round(formData?.monthlyConsumption)} kWh</strong> per maand.
          </p>
        </header>

        {/* TOP VERGELIJKER: De kleine vakjes bovenaan */}
        <h2 style={{fontSize: '18px', color: '#373737', marginBottom: '15px'}}>Snel vergelijken (Top 3)</h2>
        <div className="comparison-bar">
          {contracts.slice(0, 3).map((contract, index) => (
            <div key={`top-${index}`} className={`mini-card ${index === 0 ? 'cheapest' : ''}`}>
              {index === 0 && <span className="winner-badge">Goedkoopste</span>}
              <span className="mini-provider">{contract.provider}</span>
              <div className="mini-price-row">
                <span className="mini-price">€{contract.monthlyCost.toFixed(2).replace('.', ',')}</span>
                <span className="mini-label">/mnd</span>
              </div>
            </div>
          ))}
        </div>

        {/* VOLLEDIGE LIJST: In grid-formaat */}
        <h2 style={{fontSize: '18px', color: '#373737', marginBottom: '15px', marginTop: '40px'}}>Alle beschikbare contracten</h2>
        <div className="contracts-grid">
          {contracts.map((contract, index) => (
            <div key={index} className="contract-card">
              <div className="card-header">
                <div className="provider-icon">{contract.provider[0]}</div>
                <div>
                  <h3>{contract.provider}</h3>
                  <p className="contract-name-sub">{contract.contractName}</p>
                </div>
              </div>
              
              <div className="card-content">
                <div className="pricing-info">
                  <div className="main-price-row">
                    <span className="price-label">Geschat per maand</span>
                    <div className="price-amount">
                      €{contract.monthlyCost.toFixed(2).replace('.', ',')}
                      <span className="price-period">/mnd</span>
                    </div>
                  </div>
                  
                  <div className="yearly-total">
                    Totaal per jaar: €{contract.yearlyCost.toFixed(2).replace('.', ',')}
                  </div>

                  <div className="rates-box">
                    <div className="rate-row">
                      <span>Stroomtarief</span>
                      <span className="rate-value">€{contract.rate.toFixed(3)} /kWh</span>
                    </div>
                  </div>
                </div>
              </div>
              <button className="select-btn">Bekijk aanbod</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ComparePage