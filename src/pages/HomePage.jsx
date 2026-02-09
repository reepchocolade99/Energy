import { useState } from 'react'
import './HomePage.css'

function HomePage({ onSubmit }) {
  const [consumptionKnown, setConsumptionKnown] = useState(null) // null, 'known', 'unknown'
  const [formData, setFormData] = useState({
    address: '',
    zipCode: '',
    city: '',
    monthlyConsumption: '',
    hasGas: false,
    gasConsumption: '',
    hasSolarPanels: false,
    solarPanelCount: '',
    solarPanelType: 'unknown',
    hasHomeBattery: false,
    homeBatteryCapacity: 'unknown',
    hasSmartMeter: false,
    smartMeterFile: null,
    // For unknown consumption
    energyLabel: '',
    householdMembers: '',
  })

  const energyLabels = [
    { value: 'A', label: 'A - Zeer energiezuinig' },
    { value: 'B', label: 'B - Energiezuinig' },
    { value: 'C', label: 'C - Matig energieverbruik' },
    { value: 'D', label: 'D - Hoger energieverbruik' },
    { value: 'E', label: 'E - Hoog energieverbruik' },
    { value: 'F', label: 'F - Zeer hoog energieverbruik' },
    { value: 'G', label: 'G - Extreem hoog energieverbruik' },
    { value: 'unknown', label: 'Geen idee' },
  ]

  const solarPanelInfo = {
    monokristallijn: {
      label: 'Monokristallijn (Zwart)',
      description: 'Hoge efficiëntie (18-22%), langdurig betrouwbaar, duurder maar beter rendement op lange termijn.'
    },
    polykristallijn: {
      label: 'Polykristallijn (Blauw)',
      description: 'Goede efficiëntie (15-17%), kosteneffectief, populaire keuze voor huishoudens.'
    },
    glasglas: {
      label: 'Glas-glas zonnepanelen',
      description: 'Dubbele glaslaag, uitzonderlijke duurzaamheid, zeer weersbestendig, langere levensduur (40+ jaar).'
    },
    amorf: {
      label: 'Amorf / Dunne film panelen',
      description: 'Lager rendement (8-10%), beter in zwak licht, flexibel en licht, ideaal voor aangepaste toepassingen.'
    },
    unknown: {
      label: 'Geen idee',
      description: ''
    }
  }

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files?.[0] : value
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const estimateConsumption = () => {
    // Estimate yearly consumption based on energy label and household members
    const baseLabelConsumption = {
      'A': 1500,
      'B': 2000,
      'C': 2500,
      'D': 3500,
      'E': 4500,
      'F': 5500,
      'G': 6500,
      'unknown': 3000
    }

    const members = parseInt(formData.householdMembers) || 1
    const labelConsumption = baseLabelConsumption[formData.energyLabel] || 3000
    
    // Adjust for household size
    const estimatedYearly = labelConsumption + (members - 1) * 500
    return estimatedYearly / 12 // Return monthly estimate
  }

  const validateForm = () => {
    const newErrors = {}

    if (consumptionKnown === 'known') {
      if (!formData.monthlyConsumption) newErrors.monthlyConsumption = 'Monthly consumption is required'
      if (isNaN(formData.monthlyConsumption) || formData.monthlyConsumption <= 0) newErrors.monthlyConsumption = 'Monthly consumption must be a positive number'
    } else if (consumptionKnown === 'unknown') {
      if (!formData.energyLabel) newErrors.energyLabel = 'Energy label is required'
      if (!formData.householdMembers) newErrors.householdMembers = 'Number of household members is required'
      if (isNaN(formData.householdMembers) || formData.householdMembers <= 0) newErrors.householdMembers = 'Number of members must be a positive number'
    } else {
      newErrors.consumptionKnown = 'Please select an option'
    }

    if (formData.hasGas && (!formData.gasConsumption || isNaN(formData.gasConsumption) || formData.gasConsumption <= 0)) {
      newErrors.gasConsumption = 'Gas consumption must be a positive number'
    }
    if (formData.hasSolarPanels && (!formData.solarPanelCount || isNaN(formData.solarPanelCount) || formData.solarPanelCount <= 0)) {
      newErrors.solarPanelCount = 'Aantal zonnepanelen moet een positief getal zijn'
    }
    if (formData.hasSmartMeter && !formData.smartMeterFile) {
      newErrors.smartMeterFile = 'Bestand is vereist'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (validateForm()) {
      let submitData = { ...formData }

      // If consumption is unknown, use estimated value
      if (consumptionKnown === 'unknown') {
        submitData.monthlyConsumption = estimateConsumption()
        submitData.estimatedFromLabel = true
        submitData.energyLabelUsed = formData.energyLabel
      }

      // If smart meter file is present, process it with backend
      if (formData.smartMeterFile) {
        try {
          const fileFormData = new FormData()
          fileFormData.append('file', formData.smartMeterFile)
          
          const response = await fetch('http://localhost:5000/api/upload-smart-meter', {
            method: 'POST',
            body: fileFormData
          })
          
          if (!response.ok) {
            const error = await response.json()
            setErrors(prev => ({
              ...prev,
              smartMeterFile: error.error || 'Error processing smart meter file'
            }))
            return
          }
          
          const processedData = await response.json()
          
          // Calculate peak hour and lowest hour from hourly data
          const hourlyData = processedData.hourly_analytics
          let peakHour = 0
          let lowestHour = 0
          let maxValue = -Infinity
          let minValue = Infinity
          
          for (const [hour, data] of Object.entries(hourlyData)) {
            if (data.diff > maxValue) {
              maxValue = data.diff
              peakHour = hour
            }
            if (data.diff < minValue) {
              minValue = data.diff
              lowestHour = hour
            }
          }
          
          // Add processed smart meter data to form data
          const enhancedFormData = {
            ...submitData,
            smartMeterData: processedData.summary,
            hourlyAnalytics: hourlyData,
            peakHour: parseInt(peakHour),
            lowestHour: parseInt(lowestHour)
          }
          
          onSubmit(enhancedFormData)
        } catch (error) {
          setErrors(prev => ({
            ...prev,
            smartMeterFile: 'Error connecting to backend. Make sure the Python server is running on localhost:5000'
          }))
        }
      } else {
        onSubmit(submitData)
      }
    }
  }

  return (
    <div className="home-page">
      <div className="form-container">
        <div className="logo-header">
          <img src="/images/logo.png" alt="Energy Logo" className="logo" />
        </div>
        <h1>Energieverbruik Formulier</h1>
        <p className="subtitle">Vertel ons over je energieverbruik en wij helpen je de beste deals vinden</p>

        <form onSubmit={handleSubmit}>
          {/* Consumption Knowledge Toggle */}
          <fieldset>
            <legend>Energieverbruik Informatie</legend>
            <p className="consumption-question">Weet je je maandelijks energieverbruik?</p>
            
            <div className="consumption-toggle">
              <button
                type="button"
                className={`toggle-btn ${consumptionKnown === 'known' ? 'active' : ''}`}
                onClick={() => {
                  setConsumptionKnown('known')
                  setErrors(prev => ({ ...prev, consumptionKnown: '' }))
                }}
              >
                <span className="toggle-icon">✓</span>
                Ja, ik weet het
              </button>
              <button
                type="button"
                className={`toggle-btn ${consumptionKnown === 'unknown' ? 'active' : ''}`}
                onClick={() => {
                  setConsumptionKnown('unknown')
                  setErrors(prev => ({ ...prev, consumptionKnown: '' }))
                }}
              >
                <span className="toggle-icon">?</span>
                Nee, geen idee
              </button>
            </div>
            {errors.consumptionKnown && <span className="error-message">{errors.consumptionKnown}</span>}
          </fieldset>

          {/* If consumption is known */}
          {consumptionKnown === 'known' && (
            <>
              <fieldset>
                <legend>Je Energieverbruik</legend>
                
                <div className="form-group">
                  <label htmlFor="monthlyConsumption">Maandlijks Elektriciteitsverbruik (kWh) *</label>
                  <input
                    type="number"
                    id="monthlyConsumption"
                    name="monthlyConsumption"
                    value={formData.monthlyConsumption}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className={errors.monthlyConsumption ? 'error' : ''}
                  />
                  {errors.monthlyConsumption && <span className="error-message">{errors.monthlyConsumption}</span>}
                </div>

                <div className="smart-meter-option">
                  <label htmlFor="hasSmartMeter" className="smart-meter-label">
                    <input
                      type="checkbox"
                      id="hasSmartMeter"
                      name="hasSmartMeter"
                      checked={formData.hasSmartMeter}
                      onChange={handleChange}
                    />
                    <span className="smart-meter-text">Of upload je slimme meter data (CSV/Excel) voor nauwkeurigere analyse</span>
                  </label>
                </div>

                {formData.hasSmartMeter && (
                  <div className="form-group">
                    <label htmlFor="smartMeterFile">Upload CSV of Excel bestand *</label>
                    <input
                      type="file"
                      id="smartMeterFile"
                      name="smartMeterFile"
                      onChange={handleChange}
                      accept=".csv,.xlsx,.xls"
                      className={errors.smartMeterFile ? 'error' : ''}
                    />
                    {errors.smartMeterFile && <span className="error-message">{errors.smartMeterFile}</span>}
                    {formData.smartMeterFile && (
                      <span className="file-selected">✓ {formData.smartMeterFile.name}</span>
                    )}
                    <p className="file-help">Bestand moet 'date' en 'total' kolommen bevatten</p>
                  </div>
                )}
              </fieldset>
            </>
          )}

          {/* If consumption is unknown */}
          {consumptionKnown === 'unknown' && (
            <>
              <fieldset>
                <legend>Energie Label en Huishouden</legend>
                
                <div className="form-group">
                  <label htmlFor="energyLabel">Wat is het energielabel van je woning? *</label>
                  <select
                    id="energyLabel"
                    name="energyLabel"
                    value={formData.energyLabel}
                    onChange={handleChange}
                    className={errors.energyLabel ? 'error' : ''}
                  >
                    <option value="">-- Selecteer een label --</option>
                    {energyLabels.map(label => (
                      <option key={label.value} value={label.value}>
                        {label.label}
                      </option>
                    ))}
                  </select>
                  {errors.energyLabel && <span className="error-message">{errors.energyLabel}</span>}
                  <p className="help-text">Het energielabel kun je vinden op je energierekening of op energie-index.nl</p>
                </div>

                <div className="form-group">
                  <label htmlFor="householdMembers">Hoeveel personen wonen in het huishouden? *</label>
                  <input
                    type="number"
                    id="householdMembers"
                    name="householdMembers"
                    value={formData.householdMembers}
                    onChange={handleChange}
                    min="1"
                    max="20"
                    step="1"
                    className={errors.householdMembers ? 'error' : ''}
                  />
                  {errors.householdMembers && <span className="error-message">{errors.householdMembers}</span>}
                </div>

                <div className="estimation-box">
                  <p className="estimation-title">📊 Geschat maandelijks verbruik:</p>
                  <p className="estimation-value">{formData.energyLabel && formData.householdMembers ? `${estimateConsumption().toFixed(0)} kWh` : 'Selecteer label en huishoudgrootte'}</p>
                  <p className="estimation-note">Dit is een schatting op basis van het energielabel en huishoudgrootte</p>
                </div>
              </fieldset>
            </>
          )}

          {/* Common sections for both */}
          {consumptionKnown && (
            <>
              {/* Huisinformatie Sectie */}
              <fieldset>
                <legend>Huisinformatie</legend>

                <div className="form-group">
                  <label htmlFor="address">Adres</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={errors.address ? 'error' : ''}
                  />
                  {errors.address && <span className="error-message">{errors.address}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="zipCode">Postcode</label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      className={errors.zipCode ? 'error' : ''}
                    />
                    {errors.zipCode && <span className="error-message">{errors.zipCode}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="city">Plaats</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={errors.city ? 'error' : ''}
                    />
                    {errors.city && <span className="error-message">{errors.city}</span>}
                  </div>
                </div>
              </fieldset>

              {/* Gas section - only for known consumption */}
              {consumptionKnown === 'known' && (
                <fieldset>
                  <legend>Gas</legend>

                  <div className="form-group checkbox">
                    <input
                      type="checkbox"
                      id="hasGas"
                      name="hasGas"
                      checked={formData.hasGas}
                      onChange={handleChange}
                    />
                    <label htmlFor="hasGas">Ik heb ook gas</label>
                  </div>

                  {formData.hasGas && (
                    <div className="form-group">
                      <label htmlFor="gasConsumption">Maandlijkse gasverbruik (m³) *</label>
                      <input
                        type="number"
                        id="gasConsumption"
                        name="gasConsumption"
                        value={formData.gasConsumption}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className={errors.gasConsumption ? 'error' : ''}
                      />
                      {errors.gasConsumption && <span className="error-message">{errors.gasConsumption}</span>}
                    </div>
                  )}
                </fieldset>
              )}

              {/* Solar and Battery Section */}
              <fieldset>
                <legend>Zonnepanelen en Batterij</legend>

                <div className="form-group checkbox">
                  <input
                    type="checkbox"
                    id="hasSolarPanels"
                    name="hasSolarPanels"
                    checked={formData.hasSolarPanels}
                    onChange={handleChange}
                  />
                  <label htmlFor="hasSolarPanels">Heb je zonnepanelen?</label>
                </div>

                {formData.hasSolarPanels && (
                  <div className="form-group">
                    <label htmlFor="solarPanelCount">Hoeveel zonnepanelen? *</label>
                    <input
                      type="number"
                      id="solarPanelCount"
                      name="solarPanelCount"
                      value={formData.solarPanelCount}
                      onChange={handleChange}
                      step="1"
                      min="0"
                      className={errors.solarPanelCount ? 'error' : ''}
                    />
                    {errors.solarPanelCount && <span className="error-message">{errors.solarPanelCount}</span>}
                  </div>
                )}

                {formData.hasSolarPanels && (
                  <div className="form-group">
                    <label>Welk type zonnepaneel? *</label>
                    <div className="solar-panel-options">
                      {Object.entries(solarPanelInfo).map(([key, value]) => (
                        <div key={key} className="panel-option">
                          <input
                            type="radio"
                            id={`solarPanel_${key}`}
                            name="solarPanelType"
                            value={key}
                            checked={formData.solarPanelType === key}
                            onChange={handleChange}
                          />
                          <label htmlFor={`solarPanel_${key}`} className="panel-label">
                            <div className="panel-image-wrapper">
                              <img 
                                src={`/images/solar-panels/${key}.png`}
                                alt={value.label}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="panel-text">
                              <p className="panel-type">{value.label}</p>
                              <p className="panel-desc">{value.description}</p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                    {errors.solarPanelType && <span className="error-message">{errors.solarPanelType}</span>}
                  </div>
                )}

                <div className="form-group checkbox">
                  <input
                    type="checkbox"
                    id="hasHomeBattery"
                    name="hasHomeBattery"
                    checked={formData.hasHomeBattery}
                    onChange={handleChange}
                  />
                  <label htmlFor="hasHomeBattery">Heb je een thuisbatterij?</label>
                </div>

                {formData.hasHomeBattery && (
                  <div className="form-group">
                    <label htmlFor="homeBatteryCapacity">Hoeveel kan de batterij per jaar opslaan (kWh)?</label>
                    <select
                      id="homeBatteryCapacity"
                      name="homeBatteryCapacity"
                      value={formData.homeBatteryCapacity}
                      onChange={handleChange}
                      className={errors.homeBatteryCapacity ? 'error' : ''}
                    >
                      <option value="unknown">Geen idee</option>
                      <option value="5">Tot 5 kWh</option>
                      <option value="10">5 - 10 kWh</option>
                      <option value="15">10 - 15 kWh</option>
                      <option value="20">15 - 20 kWh</option>
                      <option value="25">20 - 25 kWh</option>
                      <option value="30">25 - 30 kWh</option>
                      <option value="40">30 - 40 kWh</option>
                      <option value="50">40 - 50 kWh</option>
                      <option value="60">50+ kWh</option>
                    </select>
                    {errors.homeBatteryCapacity && <span className="error-message">{errors.homeBatteryCapacity}</span>}
                  </div>
                )}
              </fieldset>
            </>
          )}

          {consumptionKnown && <button type="submit" className="submit-btn">Energiecontracten Vergelijken</button>}
        </form>
      </div>
    </div>
  )
}

export default HomePage
