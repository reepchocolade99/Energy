import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ComparePage.css';
import { useNavigate } from 'react-router-dom';

function ComparePage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('Dynamisch');
  const [selectedContract, setSelectedContract] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [viewMode, setViewMode] = useState('kosten');
  const [monthlyConsumption, setMonthlyConsumption] = useState(0);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5001/api/load-local-data');
      if (!response.ok) throw new Error(`Server fout: ${response.status}`);
      
      const data = await response.json();
      
      if (data.success && data.results) {
        const formatted = data.results.map(c => ({
          ...c,
          provider: c.provider || 'Onbekend',
          type: c.type || 'Onbekend',
          monthlyCost: Number(c.monthlyCost) || 0, 
          yearlyCost: Number(c.yearlyCost) || 0,
          totalUsage: Number(c.totalUsage) || 0,
          lowUsage: Number(c.lowUsage) || 0,
          normalUsage: Number(c.normalUsage) || 0,
          fixedCosts: Number(c.fixedCosts) || 0,
          monthly_breakdown: c.monthly_breakdown || {}
        }));
        
        setContracts(formatted);
        setMonthlyConsumption(data.summary?.monthlyConsumption || 0);
      }
    } catch (error) {
      console.error("ComparePage Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchContracts(); 
  }, []);

  const handleContractClick = (contract) => {
    const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    if (contract.monthly_breakdown) {
      const chartFormat = Object.entries(contract.monthly_breakdown).map(([monthNum, data]) => ({
        month: monthNames[parseInt(monthNum) - 1],
        totaal: typeof data === 'object' ? (data.totaal || 0) : (data || 0),
        normaal: data.kosten_normaal || 0,
        dal: data.kosten_dal || 0,
        verbruik_normaal: data.verbruik_normaal || 0,
        verbruik_dal: data.verbruik_dal || 0
      }));
      setMonthlyData(chartFormat);
    }
    setSelectedContract(contract);
  };

  if (loading) {
    return <div className="loading-container"><div className="loader"></div><p>De beste deals berekenen...</p></div>;
  }

  const top3 = contracts && contracts.length > 0 
    ? [...contracts].sort((a, b) => (a.monthlyCost || 0) - (b.monthlyCost || 0)).slice(0, 3) 
    : [];

  const getRange = (type) => {
    const filtered = contracts?.filter(c => c.type === type) || [];
    if (filtered.length === 0) return { min: 0, max: 0 };
    const prices = filtered.map(c => c.monthlyCost || 0);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  };

  // Stats berekenen op basis van geselecteerd contract
  const stats = (selectedContract && monthlyData.length > 0) ? {
      maxMonth: monthlyData.reduce((prev, curr) => (prev.totaal > curr.totaal) ? prev : curr),
      minMonth: monthlyData.reduce((prev, curr) => (prev.totaal < curr.totaal) ? prev : curr),
      jaarTotaal: monthlyData.reduce((sum, curr) => sum + curr.totaal, 0),
      vasteKosten: selectedContract.fixedCosts || 7.00,
      totaalVerbruik: selectedContract.totalUsage,
      verbruikNormaal: selectedContract.normalUsage,
      verbruikDal: selectedContract.lowUsage
  } : null;

  return (
    <div className="compare-page">
      <div className="compare-container">
        <header className="header">
          <div className="header-top">
            <button className="back-btn" onClick={() => navigate('/personal-data')}>
              ← Terug naar verbruik
            </button>
            <h1>Beste deals voor jou</h1>
          </div>
          <p className="comparison-info">
            Verbruik: <strong>{Math.round(monthlyConsumption)} kWh</strong>/mnd
          </p>
          <h1>Beste deals voor jou</h1>
          <p className="comparison-info">
            Verbruik: <strong>{Math.round(monthlyConsumption)} kWh</strong>/mnd
          </p>
        </header>

        <section className="best-options-container">
          <h2 className="dashboard-title">🏆 Top 3 Goedkoopste</h2>
          <div className="mini-cards-grid">
            {top3.map((contract, idx) => (
              <div key={idx} className="mini-card-item">
                <span className="mini-ranking">#{idx + 1}</span>
                <div className="mini-price-highlight">€{(contract.monthlyCost || 0).toFixed(2).replace('.', ',')}</div>
                <div className="mini-contract-name">{contract.provider}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="price-ranges-grid">
          {['Dynamisch', 'Variabel', 'Vast'].map(type => {
            const range = getRange(type);
            return (
              <div key={type} className={`range-card ${type.toLowerCase()}`}>
                <h3 className="range-title">{type}</h3>
                <div className="range-info">Min: €{range.min.toFixed(2)}</div>
                <div className="range-info">Max: €{range.max.toFixed(2)}</div>
              </div>
            );
          })}
        </section>

        <nav className="filter-nav">
          {['Dynamisch', 'Variabel', 'Vast'].map(type => (
            <button key={type} onClick={() => setSelectedType(type)} className={selectedType === type ? 'active' : ''}>
              {type}
            </button>
          ))}
        </nav>

        <div className="contracts-grid">
          {contracts.filter(c => c.type === selectedType).map((contract, index) => (
            <ContractCard key={index} contract={contract} onCardClick={() => handleContractClick(contract)} />
          ))}
        </div>
      </div>

      {selectedContract && (
        <aside className="sidebar-container">
          <div className="sidebar-header">
            <h3>{selectedContract.provider}</h3>
            <button onClick={() => setSelectedContract(null)} className="close-sidebar-btn">✕</button>
          </div>
          <div className="sidebar-content">
             <div className="chart-container">
               <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey={viewMode === 'kosten' ? 'totaal' : 'verbruik_normaal'} 
                      stroke="#96c63e" 
                      strokeWidth={3} 
                    />
                  </LineChart>
               </ResponsiveContainer>
             </div>
             
             <div className="toggle-group">
                <button onClick={() => setViewMode('kosten')} className={viewMode === 'kosten' ? 'active' : ''}>Kosten</button>
                <button onClick={() => setViewMode('verbruik')} className={viewMode === 'verbruik' ? 'active' : ''}>Verbruik</button>
             </div>

             {stats && (
                <div className="sidebar-stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Vaste leveringskosten</span>
                    <span className="stat-value">€{stats.vasteKosten.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Totaal per jaar</span>
                    <span className="stat-value">€{stats.jaarTotaal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Piek maand</span>
                    <span className="stat-value">{stats.maxMonth.month}</span>
                  </div>
                </div>
              )}          
          </div>
        </aside>
      )}
    </div>
  );
}

const ContractCard = ({ contract, onCardClick }) => (
  <div className="contract-card" onClick={onCardClick}>
    <div className="card-header">
      <div className="provider-icon">{contract.provider[0]}</div>
      <h3>{contract.provider}</h3>
    </div>
    <div className="card-content">
      <div className="main-price-row">
        <span className="price-amount">€{contract.monthlyCost.toFixed(2).replace('.', ',')}</span>
        <span className="price-period">/mnd</span>
      </div>
      <div className="rates-box">
        <div className="rate-row"><span>Type:</span> <span className="rate-value">{contract.type}</span></div>
        <div className="rate-row"><span>Jaar:</span> <span className="rate-value">€{contract.yearlyCost.toFixed(0)}</span></div>
      </div>
    </div>
    <button className="select-btn">Bekijk Details</button>
  </div>
);

export default ComparePage;