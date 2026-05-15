import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ComparePage.css';

function ComparePage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState(['Vast', 'Dynamisch', 'Variabel']); 
  const [compareList, setCompareList] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [consumption, setConsumption] = useState({ hoog: 45, laag: 25 });

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:5001/api/load-local-data?manual_hoog=${consumption.hoog}&manual_laag=${consumption.laag}`);
      const data = await response.json();
      if (data.success) {
        setContracts(data.results || []);
        setSummary(data.summary || null);
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
      if (prev.length < 3) return [...prev, contract];
      return prev;
    });
  };

  if (loading) return <div className="loader-container">Laden...</div>;

  return (
    <div className="compare-layout">
      {/* --- LINKER SIDEBAR (FILTER) --- */}
      <aside className="left-sidebar">
        <button className="back-link" onClick={() => navigate('/personal-data')}>← Terug</button>
        <h2 className="sidebar-title">Jouw Schatting</h2>
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
                <span className="checkbox-label">{type}</span>
              </label>
            ))}
          </div>
        </div>
      </aside>

      {/* --- HOOFDCONTENT --- */}
      <main className="results-area">
        <div className="results-header">
          <div>
            <h1 className="results-title">Beschikbare contracten</h1>
            {contracts.length > 0 && (
              <p className="results-subtitle">
                Op basis van: <strong>{contracts[0].estUsage} kWh</strong> verbruik en <strong>{contracts[0].estReturn} kWh</strong> teruglevering.
              </p>
            )}
          </div>
        </div>

        <div className="contracts-grid">
          {contracts
            .filter(c => selectedTypes.includes(c.type))
            .sort((a, b) => a.monthlyCost - b.monthlyCost)
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

      {/* --- RECHTER DRAWER (VERGELIJKING) --- */}
      {/* Alleen renderen als de sidebar open is en er iets te vergelijken valt */}
      {isSidebarOpen && compareList.length > 0 && (
        <div className="comparison-drawer open">
          <div className="drawer-header">
            <h2>Vergelijking</h2>
            <button className="close-drawer" onClick={() => setIsSidebarOpen(false)}>×</button>
          </div>
          <div className="drawer-content">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Kenmerken</th>
                  {compareList.map(c => <th key={c.id}>{c.provider}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Jaarverbruik (est.)</td>
                  {compareList.map(c => <td key={c.id}>{c.estUsage} kWh</td>)}
                </tr>
                <tr>
                  <td>Jaar-teruglevering</td>
                  {compareList.map(c => <td key={c.id} className="savings">-{c.estReturn} kWh</td>)}
                </tr>

                <tr className="section-header">
                  <td colSpan={compareList.length + 1}>Stroomtarieven (per kWh)</td>
                </tr>
                <tr>
                  <td>Normaal tarief</td>
                  {compareList.map(c => <td key={c.id}>€{c.compare_data?.normaal_incl.toFixed(4)}</td>)}
                </tr>
                <tr>
                  <td>Dal tarief</td>
                  {compareList.map(c => <td key={c.id}>€{c.compare_data?.dal_incl.toFixed(4)}</td>)}
                </tr>

                <tr className="section-header">
                  <td colSpan={compareList.length + 1}>Vaste Kosten (per maand)</td>
                </tr>
                <tr>
                  <td>Vaste leveringskosten</td>
                  {compareList.map(c => <td key={c.id}>€{c.compare_data?.vaste_kosten_pm.toFixed(2)}</td>)}
                </tr>
                <tr>
                  <td>Netbeheerkosten</td>
                  {compareList.map(c => <td key={c.id}>€{c.compare_data?.netbeheer_pm.toFixed(2)}</td>)}
                </tr>

                <tr className="section-header total-row">
                  <td colSpan={compareList.length + 1}>Eindafrekening</td>
                </tr>
                <tr className="price-row">
                  <td><strong>Maandkosten Totaal</strong></td>
                  {compareList.map(c => (
                    <td key={c.id} className="table-price-large">
                      €{c.monthlyCost.toFixed(2)}
                    </td>
                  ))}
                </tr>
                <tr className="year-row">
                  <td><strong>Jaarkosten Totaal</strong></td>
                  {compareList.map(c => (
                    <td key={c.id}><strong>€{c.yearlyCost.toFixed(2)}</strong></td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- ONDERBALK (STICKY) --- */}
      {compareList.length > 0 && (
        <div className="bottom-compare-bar">
          <div className="bar-left-section">
            <div className={`bar-counter ${compareList.length >= 3 ? 'limit' : ''}`}>
              {compareList.length}/3
            </div>
            <div className="selected-providers">
              {compareList.map(c => (
                <span key={c.id} className="provider-tag">{c.provider}</span>
              ))}
            </div>
          </div>
          <button 
            className="compare-now-btn bottom-bar-btn" 
            onClick={() => setIsSidebarOpen(true)}
          >
            Bekijk vergelijking
          </button>
        </div>
      )}
    </div>
  );
}

/* --- CONTRACT KAART COMPONENT --- */
const ContractCard = ({ contract, onCompareToggle, isCompared }) => {
  if (!contract) return null;
  const [euro, cents] = contract.monthlyCost.toFixed(2).split('.');
  
  return (
    <div className="contract-card">
      <div className="card-body">
        <span className="provider-name">{contract.provider}</span>
        <div className="price-tag"> 
          <span className="euro">€{euro}</span>
          <span className="cents">,{cents}</span>
          <span className="per-mnd">/mnd</span>
        </div>
        <label className="compare-check">
          <input type="checkbox" checked={isCompared} onChange={onCompareToggle} />
          <span>Vergelijk</span>
        </label>
      </div>
      <div className={`contract-type-badge ${contract.type?.toLowerCase()}`}>
        {contract.type}
      </div>
    </div>
  );
};

export default ComparePage;