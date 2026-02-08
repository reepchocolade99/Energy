import { useState, useMemo } from 'react'
import './ComparePage.css'

function ComparePage({ formData, onGoHome }) {
  // Mock energy contracts data
  const energyContracts = [
    {
      id: 1,
      provider: 'GreenEnergy Co.',
      electricityRate: 0.24,
      gasRate: 0.18,
      monthlyFee: 5,
      greenEnergy: true,
      yearlyCost: 0,
      contract: '12 months',
      image: '🌱'
    },
    {
      id: 2,
      provider: 'PowerPlus',
      electricityRate: 0.22,
      gasRate: 0.16,
      monthlyFee: 8,
      greenEnergy: false,
      yearlyCost: 0,
      contract: '24 months',
      image: '⚡'
    },
    {
      id: 3,
      provider: 'Economy Energy',
      electricityRate: 0.20,
      gasRate: 0.15,
      monthlyFee: 3,
      greenEnergy: false,
      yearlyCost: 0,
      contract: '12 months',
      image: '💰'
    },
    {
      id: 4,
      provider: 'SunPower',
      electricityRate: 0.25,
      gasRate: 0.19,
      monthlyFee: 6,
      greenEnergy: true,
      yearlyCost: 0,
      contract: '24 months',
      image: '☀️'
    },
  ]

  const [selectedContracts, setSelectedContracts] = useState([])

  // Calculate yearly cost for each contract
  const contractsWithCosts = useMemo(() => {
    return energyContracts.map(contract => {
      let monthlyCost = contract.monthlyFee + (formData.monthlyConsumption * contract.electricityRate)
      if (formData.hasGas) {
        monthlyCost += formData.gasConsumption * contract.gasRate
      }
      return {
        ...contract,
        monthlyCost: monthlyCost,
        yearlyCost: monthlyCost * 12
      }
    })
  }, [formData])

  const toggleContract = (id) => {
    setSelectedContracts(prev => {
      if (prev.includes(id)) {
        return prev.filter(c => c !== id)
      } else if (prev.length < 3) {
        return [...prev, id]
      }
      return prev
    })
  }

  const selectedContractData = contractsWithCosts.filter(c => selectedContracts.includes(c.id))

  return (
    <div className="compare-page">
      <div className="compare-container">
        <div className="header">
          <button className="back-btn" onClick={onGoHome}>← Back</button>
          <h1>Energy Contracts Comparison</h1>
          <p className="comparison-info">
            Based on consumption: {formData.monthlyConsumption} kWh/month
            {formData.hasGas && ` + ${formData.gasConsumption} m³ gas/month`}
          </p>
        </div>

        <div className="contracts-grid">
          {contractsWithCosts.map(contract => (
            <div
              key={contract.id}
              className={`contract-card ${selectedContracts.includes(contract.id) ? 'selected' : ''}`}
              onClick={() => toggleContract(contract.id)}
            >
              <div className="card-header">
                <span className="provider-icon">{contract.image}</span>
                <h3>{contract.provider}</h3>
              </div>

              <div className="card-content">
                <div className="badge-container">
                  {contract.greenEnergy && <span className="badge green">Green Energy</span>}
                  <span className="contract-duration">{contract.contract}</span>
                </div>

                <div className="pricing-info">
                  <div className="price-row">
                    <span className="label">Monthly Cost:</span>
                    <span className="price">${contract.monthlyCost.toFixed(2)}</span>
                  </div>
                  <div className="price-row main-price">
                    <span className="label">Yearly Cost:</span>
                    <span className="price">${contract.yearlyCost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="rates">
                  <div className="rate-item">
                    <span className="rate-label">Electricity:</span>
                    <span className="rate-value">${contract.electricityRate}/kWh</span>
                  </div>
                  {formData.hasGas && (
                    <div className="rate-item">
                      <span className="rate-label">Gas:</span>
                      <span className="rate-value">${contract.gasRate}/m³</span>
                    </div>
                  )}
                  <div className="rate-item">
                    <span className="rate-label">Monthly Fee:</span>
                    <span className="rate-value">${contract.monthlyFee}</span>
                  </div>
                </div>
              </div>

              <button className="select-btn">
                {selectedContracts.includes(contract.id) ? '✓ Selected' : 'Select to Compare'}
              </button>
            </div>
          ))}
        </div>

        {selectedContractData.length > 0 && (
          <div className="comparison-table">
            <h2>Detailed Comparison</h2>
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  {formData.hasGas ? (
                    <>
                      <th>Electricity Rate</th>
                      <th>Gas Rate</th>
                    </>
                  ) : (
                    <th>Electricity Rate</th>
                  )}
                  <th>Monthly Cost</th>
                  <th>Yearly Cost</th>
                </tr>
              </thead>
              <tbody>
                {selectedContractData
                  .sort((a, b) => a.yearlyCost - b.yearlyCost)
                  .map(contract => (
                  <tr key={contract.id} className={contract.yearlyCost === Math.min(...selectedContractData.map(c => c.yearlyCost)) ? 'cheapest' : ''}>
                    <td className="provider-name">
                      <span className="icon">{contract.image}</span>
                      {contract.provider}
                    </td>
                    <td>${contract.electricityRate}/kWh</td>
                    {formData.hasGas && <td>${contract.gasRate}/m³</td>}
                    <td>${contract.monthlyCost.toFixed(2)}</td>
                    <td className="yearly-cost">${contract.yearlyCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="savings-info">
              <p>
                💡 Cheapest option: <strong>{selectedContractData.sort((a, b) => a.yearlyCost - b.yearlyCost)[0].provider}</strong>
              </p>
              <p>
                Potential yearly savings: <strong>${(Math.max(...selectedContractData.map(c => c.yearlyCost)) - Math.min(...selectedContractData.map(c => c.yearlyCost))).toFixed(2)}</strong>
              </p>
            </div>
          </div>
        )}

        <div className="selection-hint">
          Select up to 3 contracts to compare details
        </div>
      </div>
    </div>
  )
}

export default ComparePage
