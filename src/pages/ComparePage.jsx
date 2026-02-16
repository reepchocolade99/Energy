import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function ComparePage({ formData, onGoBack, onGoHome }) {
  const data = formData || {};
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("LOG 1: useEffect gestart op ComparePage");
    console.log("LOG 2: Inhoud van 'data' variabele:", data);
    if (!formData || !formData.monthlyConsumption) {
      console.log("Wachten op data of geen verbruik gevonden...");
    return; 
    }

    const fetchContracts = async () => {
      console.log("LOG 3: fetchContracts functie wordt nu uitgevoerd");
      setLoading(true);
      try {
        const consumption = data?.monthlyConsumption || 0;
        
        // We halen de standaard contracten op bij de backend.
        const response = await fetch('http://localhost:5001/api/compare-contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            monthlyConsumption: consumption 
          })
        });
        
        const apiContracts = await response.json();

        // Als we data van de slimme meter hebben, voegen we het persoonlijke contract toe.
        if (data?.isFromSmartMeter && data?.variableCostsTotal) {
          const variableContract = {
            provider: "Jouw Dynamisch Tarief",
            contractName: "Berekend op jouw werkelijke uuraantallen",
            rate: data.variableCostsTotal / (consumption * 12 || 1), 
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

  if (loading) {
    return (
      <div className="loading-container">
        <p>Contracten vergelijken op basis van jouw profiel...</p>
      </div>
    );
  }

 return (
    <div className="compare-page">
      <header className="header" style={{ marginBottom: '30px' }}>
        <button onClick={onGoBack} className="back-btn" style={{ cursor: 'pointer', marginBottom: '10px' }}>
          ← Terug naar profiel
        </button>
        
        <h1>Beste deals voor jou</h1>
        
        <p className="comparison-info">
        Op basis van <strong>{Math.round(formData?.monthlyConsumption || 0)} kWh</strong> per maand.
      </p>
      </header>

      <div className="contracts-grid" style={{ display: 'grid', gap: '20px' }}>
        {contracts.map((contract, index) => (
          <div 
            key={index} 
            className={`contract-card ${contract.isVariable ? 'variable-highlight' : ''}`} 
            style={{ 
              border: '1px solid #ddd', 
              padding: '20px', 
              borderRadius: '12px', 
              background: contract.isVariable ? '#f0f7ff' : '#fff',
              boxShadow: contract.isVariable ? '0 4px 12px rgba(0,123,255,0.1)' : 'none'
            }}
          >
            {contract.isVariable && (
              <span style={{ color: '#007bff', fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '5px' }}>
                ✓ Jouw slimme meter profiel
              </span>
            )}
            
            <h3 style={{ margin: '5px 0' }}>{contract.provider}</h3>
            <p style={{ color: '#555', fontSize: '0.9rem' }}>{contract.contractName}</p>
            
            <div className="price-box" style={{ marginTop: '15px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                €{contract.monthlyCost.toFixed(2).replace('.', ',')} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>/mnd</span>
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>
                Jaarkosten: €{contract.yearlyCost.toFixed(2).replace('.', ',')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ); // Sluit de return af
} // Sluit de functie ComparePage af

export default ComparePage;