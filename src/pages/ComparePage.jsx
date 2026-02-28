import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function ComparePage({ formData, onGoBack, onGoHome }) {
  const data = formData || {};
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('Dynamisch');
  const [selectedContract, setSelectedContract] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    console.log("LOG 1: useEffect gestart op ComparePage");
    console.log("LOG 2: Inhoud van 'data' variabele:", data);
    if (!formData || !formData.monthlyConsumption) {
      console.log("Wachten op data of geen verbruik gevonden...");
      setLoading(false);
      return;
    }

    const fetchContracts = async () => {
      console.log("LOG 3: fetchContracts functie wordt nu uitgevoerd");
      setLoading(true);
      try {
        const monthlyNormalUsed = data?.consumptionSplit?.monthly_normal_used || (data?.monthlyConsumption * 0.7) || 0;
        const monthlyLowUsed = data?.consumptionSplit?.monthly_low_used || (data?.monthlyConsumption * 0.3) || 0;
        
        // We halen de standaard contracten op bij de backend.
        const response = await fetch('http://localhost:5001/api/compare-contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            monthlyNormalUsed: monthlyNormalUsed,
            monthlyLowUsed: monthlyLowUsed
          })
        });
        
        const apiContracts = await response.json();

        // Keep the initial contract list lightweight. We'll compute per-contract
        // monthly details on demand when the user clicks a contract to avoid
        // making N*12 backend calls during initial load.
        // Als we data van de slimme meter hebben, voegen we het persoonlijke contract toe.
        if (data?.isFromSmartMeter && data?.variableCostsTotal) {
          const variableContract = {
            provider: "Jouw Dynamisch Tarief",
            contractName: "Berekend op jouw werkelijke uuraantallen",
            monthlyCostNormal: (data.variableCostsTotal / 12) * 0.7,
            monthlyCostLow: (data.variableCostsTotal / 12) * 0.3,
            monthlyCostExtra: 0,
            monthlyCost: data.variableCostsTotal / 12,
            yearlyCost: data.variableCostsTotal,
            isVariable: true 
          };
          const combined = [...apiContracts, variableContract].sort((a, b) => a.monthlyCost - b.monthlyCost);
          setContracts(combined);
        } else {
          setContracts(apiContracts);
        }

        setLoading(false);
      } catch (error) {
        console.error("Fout bij ophalen contracten:", error);
        setLoading(false);
      }
    };

    if (data && Object.keys(data).length > 0) {
      fetchContracts();
    } else {
      // Als er geen data is (bijv. direct naar de URL gaan), stop dan met laden.
      setLoading(false);
    }
  }, [data]); 

  const calculateMonthlyDataFromBackend = async (contract) => {
    const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const monthlyData = [];

    try {
      // If this is the zonnenplan contract, fetch precomputed monthly breakdown from backend
      if (contract && (contract.provider === 'zonnenplan.nl' || contract.contractName === 'Dynamisch')) {
        try {
          const resp = await fetch('http://localhost:5001/api/zonnenplan-monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          const zp = await resp.json();
          if (zp && zp.length > 0) {
            return zp.map(item => ({
              month: item.month,
              normaal: Number(item.normaal) || 0,
              dal: Number(item.dal) || 0,
              totaal: Number(item.totaal) || 0,
              verbruik_normaal: Number(item.verbruik_normaal) || 0,
              verbruik_dal: Number(item.verbruik_dal) || 0,
              vergoeding_normaal: Number(item.vergoeding_normaal) || 0,
              vergoeding_dal: Number(item.vergoeding_dal) || 0,
              vergoeding_totaal: Number(item.vergoeding_totaal) || 0
            }));
          }
        } catch (err) {
          console.error('Fout bij ophalen zonnenplan maanddata:', err);
        }
        // fallthrough to default if zonnenplan endpoint fails
      }

      // Default path: fetch per-month day aggregates
      for (let month = 1; month <= 12; month++) {
        const response = await fetch('http://localhost:5001/api/monthly-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            uploadedFile: data?.uploadedFile || 'smart_meter_data.csv',
            month: month
          })
        });

        const dayData = await response.json();
        
        if (dayData && dayData.length > 0) {
          // Aggregeer per maand using backend-provided normal/low fields
          let totalNormalVerbruik = 0;
          let totalLowVerbruik = 0;

          dayData.forEach(day => {
            // monthly-detail now returns 'normal' and 'low' per day
            const normal = parseFloat(day.normal || 0);
            const low = parseFloat(day.low || 0);
            totalNormalVerbruik += normal;
            totalLowVerbruik += low;
          });

          // Backend retourneert al de juiste rates (inclusief 0.014 voor dynamische)
          const normalRate = parseFloat(contract.normalRate?.toString().replace(',', '.')) || 0;
          const lowRate = parseFloat(contract.lowRate?.toString().replace(',', '.')) || 0;

          const normalCost = totalNormalVerbruik * normalRate;
          const lowCost = totalLowVerbruik * lowRate;
          const monthlyCost = normalCost + lowCost + (contract.monthlyCostExtra || 0);

          monthlyData.push({
            month: monthNames[month - 1],
            normaal: parseFloat(normalCost.toFixed(2)),
            dal: parseFloat(lowCost.toFixed(2)),
            totaal: parseFloat(monthlyCost.toFixed(2)),
            verbruik_normaal: parseFloat(totalNormalVerbruik.toFixed(2)),
            verbruik_dal: parseFloat(totalLowVerbruik.toFixed(2))
          });
        }
      }
    } catch (error) {
      console.error("Fout bij laden maandelijkse gegevens:", error);
    }

    // Sanitize monthlyData: ensure month label and numeric values
    const sanitized = monthlyData.map(item => ({
      month: item.month || '',
      normaal: Number.isFinite(Number(item.normaal)) ? Number(item.normaal) : 0,
      dal: Number.isFinite(Number(item.dal)) ? Number(item.dal) : 0,
      totaal: Number.isFinite(Number(item.totaal)) ? Number(item.totaal) : 0,
      verbruik_normaal: Number.isFinite(Number(item.verbruik_normaal)) ? Number(item.verbruik_normaal) : 0,
      verbruik_dal: Number.isFinite(Number(item.verbruik_dal)) ? Number(item.verbruik_dal) : 0
    }));

    return sanitized.length > 0 ? sanitized : generateDefaultMonthlyData(contract);
  };

  const generateDefaultMonthlyData = (contract) => {
    // Fallback: use average monthly data
    const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    
    const normalUsed = data?.consumptionSplit?.monthly_normal_used || (data?.monthlyConsumption * 0.7) || 0;
    const lowUsed = data?.consumptionSplit?.monthly_low_used || (data?.monthlyConsumption * 0.3) || 0;
    
    // Backend retourneert al de juiste rates (inclusief 0.014 voor dynamische)
    const normalRate = parseFloat(contract.normalRate?.toString().replace(',', '.')) || 0;
    const lowRate = parseFloat(contract.lowRate?.toString().replace(',', '.')) || 0;
    
    return monthNames.map((month) => {
      const normalCost = normalUsed * normalRate;
      const lowCost = lowUsed * lowRate;
      const monthlyCost = normalCost + lowCost + (contract.monthlyCostExtra || 0);
      
      return {
        month: month,
        normaal: parseFloat(normalCost.toFixed(2)),
        dal: parseFloat(lowCost.toFixed(2)),
        totaal: parseFloat(monthlyCost.toFixed(2))
      };
    });
  };

  const handleContractClick = async (contract) => {
    // Fetch backend monthly breakdown for this contract and compute prices
    const md = await calculateMonthlyDataFromBackend(contract);
    console.log('DEBUG contract clicked:', contract);
    if (!md || md.length === 0) {
      console.log('DEBUG no monthly data returned from backend for this contract');
      setMonthlyData([]);
      setSelectedContract(contract);
      return;
    }

    // compute totals from backend-derived monthly data
    const totalYear = md.reduce((sum, m) => sum + (Number(m.totaal) || 0), 0);
    const totalNormal = md.reduce((sum, m) => sum + (Number(m.normaal) || 0), 0);
    const totalLow = md.reduce((sum, m) => sum + (Number(m.dal) || 0), 0);

    const monthlyCost = parseFloat((totalYear / 12).toFixed(2));
    const monthlyCostNormal = parseFloat(((totalNormal / 12) || 0).toFixed(2));
    const monthlyCostLow = parseFloat(((totalLow / 12) || 0).toFixed(2));
    const yearlyCost = parseFloat(totalYear.toFixed(2));

    // Update selected contract with computed prices and store monthly data
    const updatedContract = {
      ...contract,
      monthlyCost,
      monthlyCostNormal,
      monthlyCostLow,
      yearlyCost,
      monthlyDataFromBackend: md
    };

    // Update contracts list so displayed cards reflect backend-based prices
    setContracts(prev => prev.map(c => (c.provider === contract.provider && c.contractName === contract.contractName ? updatedContract : c)));
    setMonthlyData(md);
    setSelectedContract(updatedContract);
  }; 

  if (loading) {
    return (
      <div className="loading-container">
        <p>Contracten vergelijken op basis van jouw profiel...</p>
      </div>
    );
  }

 return (
    <div className="compare-page" style={{ display: 'flex', gap: '30px' }}>
      <div style={{ flex: selectedContract ? '0 0 60%' : '1' }}>
      <header className="header" style={{ marginBottom: '30px' }}>
        <button onClick={onGoBack} className="back-btn" style={{ cursor: 'pointer', marginBottom: '10px' }}>
          ← Terug naar profiel
        </button>
        
        <h1>Beste deals voor jou</h1>
        
        <div className="comparison-info">
        Op basis van <strong>{Math.round(formData?.monthlyConsumption || 0)} kWh</strong> per maand.
        {formData?.consumptionSplit && (
          <div style={{ fontSize: '0.9rem', marginTop: '5px', color: '#666' }}>
            Normale uren: <strong>{Math.round(formData?.consumptionSplit?.monthly_normal_used || 0)} kWh</strong> | 
            Dal uren: <strong>{Math.round(formData?.consumptionSplit?.monthly_low_used || 0)} kWh</strong>
          </div>
        )}
      </div>
      </header>


      {/* Overzicht: 3 Beste Opties */}
      {(() => {
        const top3 = contracts.filter(c => !c.isVariable).sort((a, b) => a.monthlyCost - b.monthlyCost).slice(0, 3);
        const dynamischContracts = contracts.filter(c => c.contractName === 'Dynamisch' && !c.isVariable);
        const variabelContracts = contracts.filter(c => c.contractName === 'Variabel' && !c.isVariable);
        const vastContracts = contracts.filter(c => c.contractName === 'Vast' && !c.isVariable);

        const getDynamischRange = () => {
          if (dynamischContracts.length === 0) return { min: 0, max: 0 };
          const prices = dynamischContracts.map(c => c.monthlyCost);
          return { min: Math.min(...prices), max: Math.max(...prices) };
        };

        const getVariabelRange = () => {
          if (variabelContracts.length === 0) return { min: 0, max: 0 };
          const prices = variabelContracts.map(c => c.monthlyCost);
          return { min: Math.min(...prices), max: Math.max(...prices) };
        };

        const getVastRange = () => {
          if (vastContracts.length === 0) return { min: 0, max: 0 };
          const prices = vastContracts.map(c => c.monthlyCost);
          return { min: Math.min(...prices), max: Math.max(...prices) };
        };

        const dynamischRange = getDynamischRange();
        const variabelRange = getVariabelRange();
        const vastRange = getVastRange();

        return (
          <>
            {/* Top 3 Beste Opties */}
            <div style={{ marginBottom: '40px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '2px solid #96c63e' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/images/icons/Ranking-Winner-Medal--Streamline-Ultimate.png" alt="Variabel" style={{ width: '20px', height: '20px' }} />

                3 Beste Opties
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {top3.map((contract, idx) => (
                  <div key={idx} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <div style={{ fontSize: '14px', color: '#666' }}>{idx + 1}. {contract.provider}</div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#96c63e', marginTop: '5px' }}>
                      €{contract.monthlyCost.toFixed(2).replace('.', ',')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>{contract.contractName}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prijs Ranges per Type */}
            <div style={{ marginBottom: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
              {/* Dynamisch */}
              <div style={{ backgroundColor: '#f0f8ff', padding: '15px', borderRadius: '8px', border: '2px solid #96c63e' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src="/images/icons/Analytics-Bars-Horizontal--Streamline-Ultimate.png" alt="Dynamisch" style={{ width: '20px', height: '20px' }} />
                  Dynamisch
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  <strong>Goedkoopste:</strong> €{dynamischRange.min.toFixed(2).replace('.', ',')}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <strong>Duurste:</strong> €{dynamischRange.max.toFixed(2).replace('.', ',')}
                </div>
              </div>

              {/* Variabel */}
              <div style={{ backgroundColor: '#fff8f0', padding: '15px', borderRadius: '8px', border: '2px solid #ff9800' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src="/images/icons/Presentation-Projector-Screen-Clock--Streamline-Ultimate.png" alt="Variabel" style={{ width: '20px', height: '20px' }} />
                  Variabel
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  <strong>Goedkoopste:</strong> €{variabelRange.min.toFixed(2).replace('.', ',')}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <strong>Duurste:</strong> €{variabelRange.max.toFixed(2).replace('.', ',')}
                </div>
              </div>

              {/* Vast */}
              <div style={{ backgroundColor: '#f0f7ff', padding: '15px', borderRadius: '8px', border: '2px solid #2196F3' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src="/images/icons/Keyhole-Square--Streamline-Ultimate.png" alt="Vast" style={{ width: '20px', height: '20px' }} />
                  Vast
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  <strong>Goedkoopste:</strong> €{vastRange.min.toFixed(2).replace('.', ',')}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <strong>Duurste:</strong> €{vastRange.max.toFixed(2).replace('.', ',')}
                </div>
              </div>
            </div>
          </>
        );
      })()}
      {/* Knoppen voor categorieën */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <button
          onClick={() => setSelectedType('Dynamisch')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            fontWeight: selectedType === 'Dynamisch' ? 'bold' : 'normal',
            backgroundColor: selectedType === 'Dynamisch' ? '#96c63e' : '#f0f0f0',
            color: selectedType === 'Dynamisch' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (selectedType !== 'Dynamisch') {
              e.target.style.backgroundColor = '#e0e0e0';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedType !== 'Dynamisch') {
              e.target.style.backgroundColor = '#f0f0f0';
            }
          }}
        >
          <img src="/images/icons/Analytics-Bars-Horizontal--Streamline-Ultimate.png" alt="Dynamisch" style={{ width: '20px', height: '20px' }} />
          Dynamische
        </button>

        <button
          onClick={() => setSelectedType('Variabel')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            fontWeight: selectedType === 'Variabel' ? 'bold' : 'normal',
            backgroundColor: selectedType === 'Variabel' ? '#ff9800' : '#f0f0f0',
            color: selectedType === 'Variabel' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (selectedType !== 'Variabel') {
              e.target.style.backgroundColor = '#e0e0e0';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedType !== 'Variabel') {
              e.target.style.backgroundColor = '#f0f0f0';
            }
          }}
        >
          <img src="/images/icons/Presentation-Projector-Screen-Clock--Streamline-Ultimate.png" alt="Variabel" style={{ width: '20px', height: '20px' }} />
          Variabel
        </button>

        <button
          onClick={() => setSelectedType('Vast')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            fontWeight: selectedType === 'Vast' ? 'bold' : 'normal',
            backgroundColor: selectedType === 'Vast' ? '#2196F3' : '#f0f0f0',
            color: selectedType === 'Vast' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (selectedType !== 'Vast') {
              e.target.style.backgroundColor = '#e0e0e0';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedType !== 'Vast') {
              e.target.style.backgroundColor = '#f0f0f0';
            }
          }}
        >
          <img src="/images/icons/Keyhole-Square--Streamline-Ultimate.png" alt="Vast" style={{ width: '20px', height: '20px' }} />
          Vast
        </button>
      </div>

      {/* Contract kaarten voor geselecteerde type */}
      <div>
        <div className="contracts-grid" style={{ display: 'grid', gridTemplateColumns: selectedContract ? '1fr' : 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px', justifyContent: 'center' }}>
          {contracts.filter(c => c.contractName === selectedType && !c.isVariable).map((contract, index) => (
            <div key={index} style={{ width: selectedContract ? '720px' : '100%', margin: selectedContract ? '0 auto' : '0' }}>
              <ContractCard contract={contract} onCardClick={() => handleContractClick(contract)} />
            </div>
          ))}
        </div>

        
      </div>
      </div>

      {/* Sidebar met contract details */}
      {selectedContract && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '42%',
          maxWidth: '640px',
          backgroundColor: '#f9f9f9',
          padding: '30px',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedContract.provider}</h2>
              <div style={{ color: '#666', marginTop: '6px' }}>{selectedContract.contractName}</div>
            </div>
            <button
              onClick={() => setSelectedContract(null)}
              aria-label="Sluit"
              style={{
                background: '#ff6b6b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Sluit
            </button>
          </div>

          {monthlyData.length > 0 ? (
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Maandelijkse kostenoverzicht</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
                  <XAxis 
                    dataKey="month" 
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    label={{ value: 'Kosten (€)', angle: -90, position: 'insideLeft' }}
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    formatter={(value) => {
                      const n = Number(value);
                      if (!isFinite(n)) return '-';
                      return `€${n.toFixed(2)}`;
                    }}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="normaal" stroke="#96c63e" strokeWidth={2} name="Normaal tarief" isAnimationActive={false} />
                  <Line type="monotone" dataKey="dal" stroke="#ff9800" strokeWidth={2} name="Dal tarief" isAnimationActive={false} />
                  <Line type="monotone" dataKey="totaal" stroke="#2196F3" strokeWidth={2.5} name="Totaal" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>

              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Selecteer maand voor details:
                </label>
                <select
                  value={selectedMonth ? selectedMonth : ''}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    backgroundColor: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Kies een maand...</option>
                  {monthlyData.map((month, idx) => (
                    <option key={idx} value={month.month}>{month.month}</option>
                  ))}
                </select>
              </div>

              {selectedMonth && monthlyData.find(m => m.month === selectedMonth) && (
                <div style={{ marginTop: '15px', backgroundColor: '#e8f5e9', padding: '12px', borderRadius: '8px', border: '1px solid #4caf50' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#2e7d32' }}>
                    Details {selectedMonth}
                  </h4>
                  {(() => {
                    const monthData = monthlyData.find(m => m.month === selectedMonth);
                    if (!monthData) return null;
                    return (
                      <div style={{ fontSize: '13px' }}>
                        <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #c8e6c9' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#2e7d32' }}>Energieverbruik:</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>Normaal uren:</span>
                            <span style={{ fontWeight: 'bold' }}>{monthData.verbruik_normaal.toFixed(2)} kWh</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Dal uren:</span>
                            <span style={{ fontWeight: 'bold' }}>{monthData.verbruik_dal.toFixed(2)} kWh</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#2e7d32' }}>Kosten:</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span>Terugleververgoeding totaal:</span>
                            <span style={{ fontWeight: 'bold', color: '#007bff' }}>€{(monthData.vergoeding_totaal || 0).toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span>- Normaal vergoeding:</span>
                            <span style={{ fontWeight: 'bold' }}>€{(monthData.vergoeding_normaal || 0).toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span>- Dal vergoeding:</span>
                            <span style={{ fontWeight: 'bold' }}>€{(monthData.vergoeding_dal || 0).toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span>Normaal tarief:</span>
                            <span style={{ fontWeight: 'bold' }}>€{monthData.normaal.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span>Dal tarief:</span>
                            <span style={{ fontWeight: 'bold' }}>€{monthData.dal.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #4caf50', paddingTop: '6px', fontWeight: 'bold', color: '#2e7d32' }}>
                            <span>Totaal:</span>
                            <span>€{monthData.totaal.toFixed(2).replace('.', ',')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div style={{ marginTop: '30px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <h4 style={{ marginTop: 0, marginBottom: '15px' }}>Samenvatting</h4>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Normale uren:</span>
                    <span style={{ fontWeight: 'bold' }}>€{selectedContract.monthlyCostNormal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Dal uren:</span>
                    <span style={{ fontWeight: 'bold' }}>€{selectedContract.monthlyCostLow.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '8px', fontSize: '1.1em', fontWeight: 'bold' }}>
                    <span>Totaal per maand:</span>
                    <span style={{ color: '#96c63e' }}>€{selectedContract.monthlyCost.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: '#666', fontSize: '0.9em' }}>
                    <span>Per jaar:</span>
                    <span>€{(selectedContract.monthlyCost * 12).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#999' }}>Gegevens laden...</p>
          )}
        </div>
      )}
    </div>
  ); // Sluit de return af
} // Sluit de functie ComparePage af

const ContractCard = ({ contract, onCardClick }) => (
  <div 
    className={`contract-card ${contract.isVariable ? 'variable-highlight' : ''}`} 
    onClick={onCardClick}
    style={{ 
      border: '1px solid #ddd', 
      padding: '20px', 
      borderRadius: '12px', 
      background: contract.isVariable ? '#f0f7ff' : '#fff',
      boxShadow: contract.isVariable ? '0 4px 12px rgba(0,123,255,0.1)' : '0 2px 8px rgba(0,0,0,0.08)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer',
      height: '100%'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = contract.isVariable ? '0 6px 16px rgba(0,123,255,0.2)' : '0 4px 16px rgba(0,0,0,0.15)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = contract.isVariable ? '0 4px 12px rgba(0,123,255,0.1)' : '0 2px 8px rgba(0,0,0,0.08)';
    }}
  >
    {contract.isVariable && (
      <span style={{ color: '#007bff', fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '5px' }}>
        ✓ Jouw slimme meter profiel
      </span>
    )}
    
    <h3 style={{ margin: '5px 0', fontSize: '18px' }}>{contract.provider}</h3>
    <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '15px' }}>{contract.contractName}</p>
    
    <div className="price-box" style={{ marginTop: '15px' }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
        €{contract.monthlyCost.toFixed(2).replace('.', ',')} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>/mnd</span>
      </div>
      
      <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Normaal tarief:</span>
          <span style={{ fontWeight: 'bold' }}>€{contract.monthlyCostNormal.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Dal tarief:</span>
          <span style={{ fontWeight: 'bold' }}>€{contract.monthlyCostLow.toFixed(2).replace('.', ',')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Vaste kosten:</span>
          <span style={{ fontWeight: 'bold' }}>€{contract.monthlyCostExtra.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>
      
      <div style={{ color: '#666', fontSize: '0.9rem' }}>
        Jaarkosten: €{contract.yearlyCost.toFixed(2).replace('.', ',')}
      </div>
    </div>
  </div>
);

export default ComparePage;