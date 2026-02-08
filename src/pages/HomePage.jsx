import { useState } from 'react'
import './HomePage.css'

function HomePage({ onSubmit }) {
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
  })

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

  const validateForm = () => {
    const newErrors = {}

    if (!formData.monthlyConsumption) newErrors.monthlyConsumption = 'Monthly consumption is required'
    if (isNaN(formData.monthlyConsumption) || formData.monthlyConsumption <= 0) newErrors.monthlyConsumption = 'Monthly consumption must be a positive number'
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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
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

          {/* Energieverbruik Sectie */}
          <fieldset>
            <legend>Energieverbruik</legend>

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

          {/* Smart Meter Section */}
          <fieldset>
            <legend>Slimme Meter</legend>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="hasSmartMeter"
                name="hasSmartMeter"
                checked={formData.hasSmartMeter}
                onChange={handleChange}
              />
              <label htmlFor="hasSmartMeter">Heb je een slimme meter?</label>
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
              </div>
            )}
          </fieldset>

          <button type="submit" className="submit-btn">Energiecontracten Vergelijken</button>
        </form>
      </div>
    </div>
  )
}

export default HomePage
