import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ComparePage.css';

function ComparePage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState(['Vast', 'Dynamisch', 'Variabel']); 
  const [compareList, setCompareList] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [consumption, setConsumption] = useState({ hoog: 45, laag: 25 });

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5001/api/load-local-data');
      const data = await response.json();
      if (data.success) {
        setContracts(data.results || []);
      }
    } catch (e) { 
      console.error("Fout bij laden data:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchContracts(); }, []);

  const handleTypeToggle = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? (prev.length > 1 ? prev.filter(t => t !== type) : prev) 
        : [...prev, type]
    );
  };

  const toggleCompare = (contract) => {
    setCompareList((prev) => {
      const isAlreadySelected = prev.find((item) => item.id === contract.id);
      if (isAlreadySelected) return prev.filter((item) => item.id !== contract.id);
      if (prev.length < 3) return [...prev, contract]; // Max 3 voor overzichtelijkheid
      return prev;
    });
  };

  if (loading) return <div className="loader-container">Laden...</div>;

  return (
    <div className="compare-layout">
      {/* LINKER SIDEBAR - FILTERS */}
      <aside className="left-sidebar">
        <button className="back-link" onClick={() => navigate('/personal-data')}>← Terug</button>
        <h2 className="sidebar-title">Jouw Gegevens</h2>
        
        <div className="input-group">
          <label>Verbruik Normaal (kWh)</label>
          <input type="number" value={consumption.hoog} onChange={(e) => setConsumption({...consumption, hoog: +e.target.value})} />
        </div>

        <div className="input-group">
          <label>Verbruik Dal (kWh)</label>
          <input type="number" value={consumption.laag} onChange={(e) => setConsumption({...consumption, laag: +e.target.value})} />
        </div>

        <button className="apply-btn" onClick={fetchContracts}>Update Berekening</button>

        <div className="type-selector-section">
          <h3>Contractvorm</h3>
          <div className="type-checkboxes-vertical">
            {['Vast', 'Dynamisch', 'Variabel'].map(type => (
              <label key={type} className="type-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => handleTypeToggle(type)}
                />
                <span className="checkbox-label">
                  {type}
                </span>
              </label>
            ))}
          </div>
        </div>
        </aside>

      {/* MIDDEN - CONTRACTEN */}
      <main className="results-area">
        <h1 className="results-title">Beschikbare contracten</h1>
        <div className="contracts-grid">
          {contracts
            .filter(c => selectedTypes.includes(c.type))
            .map((c) => (
              <ContractCard 
                key={c.id} 
                contract={c} 
                onCompareToggle={() => toggleCompare(c)}
                isCompared={compareList.some(item => item.id === c.id)} 
              />
            ))
          }
        </div>
      </main>

      {/* RECHTER SIDEBAR - VERGELIJKING (SCHUIFT IN) */}
      <div className={`comparison-drawer ${isSidebarOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>Vergelijking</h2>
          <button className="close-drawer" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>
        <div className="drawer-content">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Kenmerken</th>
                {compareList.map(c => (
                  <th key={c.id}>{c.provider}</th>
                ))}
              </tr>
            </thead>
            {/* Zoek de <tbody> in je comparison-drawer en vervang de rijen: */}
            <tbody>
              <tr>
                <td><strong>Type</strong></td>
                {compareList.map(c => <td key={c.id}>{c.type || 'Variabel'}</td>)}
              </tr>
              <tr>
                <td><strong style={{ color: '#f9943c' }}>Jaarverbruik (geschat)</strong></td>
                {compareList.map(c => <td key={c.id}>{c.estUsage} kWh</td>)}
              </tr>
              <tr>
                <td><strong style={{ color: '#3C9953' }}>Teruglevering (geschat)</strong></td>
                {compareList.map(c => <td key={c.id}>-{c.estReturn} kWh</td>)}
              </tr>
              <tr>
                <td><strong>Netto stroom</strong></td>
                {compareList.map(c => (
                  <td key={c.id}>
                    {Math.max(0, c.estUsage - c.estReturn).toFixed(0)} kWh
                  </td>
                ))}
              </tr>
              <tr className="price-row">
                <td><strong>Maandkosten</strong></td>
                {compareList.map(c => (
                  <td key={c.id} className="table-price" style={{ color: '#195c2f' }}> {/* BeNext Dark Green [cite: 16] */}
                    €{c.monthlyCost.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ONDERSTE BALK */}
      {compareList.length > 0 && (
        <div className="bottom-compare-bar">
          <div className="bar-left-section">
            {/* DE TELLER IN DE BALK */}
            <div className={`bar-counter ${compareList.length >= 3 ? 'limit' : ''}`}>
              {compareList.length}/3
            </div>
            
            <div className="selected-providers">
              {compareList.map(c => (
                <span key={c.id} className="provider-tag">{c.provider}</span>
              ))}
            </div>
          </div>

          <button className="compare-now-btn bottom-bar-btn" onClick={() => setIsSidebarOpen(true)}>
            Bekijk vergelijking
          </button>
        </div>
      )}
    </div>
  );
}

const ContractCard = ({ contract, onCompareToggle, isCompared }) => {
  const [euro, cents] = contract.monthlyCost.toFixed(2).split('.');
  
  return (
    <div className="contract-card" style={{ borderRadius: '0.65rem' }}> {/*  */}
      <div className="card-body">
        <span className="provider-name" style={{ fontWeight: 700, fontFamily: 'Mulish' }}>{contract.provider}</span>
        
        <div className="price-tag"> 
          <span className="euro">€{euro}</span>
          <span className="cents">,{cents}</span>
          <span className="per-mnd">/mnd</span>
        </div>

        {/* Energie details sectie */}
        <div className="energy-details">
          <div className="detail-item" style={{ color: 'var(--benext-green)' }}> {/* BeNext Dark Orange [cite: 17] */}
            <strong>Verbruik:</strong> {contract.estUsage} kWh
          </div>
          <div className="detail-item" style={{ color: 'var(--benext-orange)' }}> {/* BeNext Green [cite: 18] */}
            <strong>Teruglevering:</strong> {contract.estReturn} kWh
          </div>
        </div>

        <label className="compare-check">
          <input type="checkbox" checked={isCompared} onChange={onCompareToggle} />
          <span>Vergelijk</span>
        </label>
      </div>
      <div className={`contract-type-badge ${contract.type?.toLowerCase()}`}>
        {contract.type || 'Onbekend'}
      </div>
    </div>
  );
};

export default ComparePage;