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
    energyUnit: 'kWh', // Belangrijk voor MWh/kWh keuze
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
    monokristallijn: { label: 'Monokristallijn (Zwart)', description: 'Hoge efficiëntie (18-22%).' },
    polykristallijn: { label: 'Polykristallijn (Blauw)', description: 'Kosteneffectief.' },
    glasglas: { label: 'Glas-glas', description: 'Uitzonderlijke duurzaamheid.' },
    amorf: { label: 'Amorf', description: 'Beter in zwak licht.' },
    unknown: { label: 'Geen idee', description: '' }
  }

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files?.[0] : value
    }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const estimateConsumption = () => {
    const baseLabelConsumption = { 'A': 1500, 'B': 2000, 'C': 2500, 'D': 3500, 'E': 4500, 'F': 5500, 'G': 6500, 'unknown': 3000 }
    const members = parseInt(formData.householdMembers) || 0
    const labelConsumption = baseLabelConsumption[formData.energyLabel] || 0
    if (members === 0 || labelConsumption === 0) return 0
    const estimatedYearly = labelConsumption + (members - 1) * 500
    return estimatedYearly / 12
  }

  const validateForm = () => {
    const newErrors = {};
    if (consumptionKnown === 'known') {
      if (formData.hasSmartMeter) {
        if (!formData.smartMeterFile) newErrors.smartMeterFile = 'Upload een bestand';
      } else {
        if (!formData.monthlyConsumption) newErrors.monthlyConsumption = 'Verbruik is verplicht';
        else if (isNaN(formData.monthlyConsumption) || formData.monthlyConsumption <= 0) newErrors.monthlyConsumption = 'Voer een positief getal in';
      }
    } else if (consumptionKnown === 'unknown') {
      if (!formData.energyLabel) newErrors.energyLabel = 'Energielabel is verplicht';
      if (!formData.householdMembers || formData.householdMembers <= 0) newErrors.householdMembers = 'Aantal personen is verplicht';
    } else {
      newErrors.consumptionKnown = 'Maak een keuze';
    }

    if (formData.hasGas && (!formData.gasConsumption || formData.gasConsumption <= 0)) newErrors.gasConsumption = 'Vul gasverbruik in';
    if (formData.hasSolarPanels && (!formData.solarPanelCount || formData.solarPanelCount <= 0)) newErrors.solarPanelCount = 'Vul aantal panelen in';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = async (e) => {
  e.preventDefault();
  console.log("Submit geklikt!");

  if (validateForm()) {
    console.log("Validatie geslaagd, versturen naar backend...");
    let submitData = { ...formData };

    // ROUTE 1: Verbruik onbekend (Schatten op basis van label)
    if (consumptionKnown === 'unknown') {
      submitData.monthlyConsumption = estimateConsumption();
      submitData.estimatedFromLabel = true;
      onSubmit(submitData);
      return;
    }

    // ROUTE 2: Slimme meter bestand uploaden
    if (formData.hasSmartMeter && formData.smartMeterFile) {
      try {
        const fileFormData = new FormData();
        fileFormData.append('file', formData.smartMeterFile);
        fileFormData.append('unit', formData.energyUnit || 'kWh');
        
        const backendUrl = "http://127.0.0.1:5001/api/upload-smart-meter";
        const response = await fetch(backendUrl, {
          method: 'POST',
          body: fileFormData
        });

        console.log("Stap 1: Response ontvangen. Status:", response.status);

        // Belangrijk: we lezen de response eerst als tekst om te zien wat er ECHT binnenkomt
        const rawText = await response.text();
        console.log("Stap 2: Ruwe data van server:", rawText);

        if (!response.ok) {
          console.error("Stap 3: Server gaf een foutmelding.");
          let errorMessage = 'Upload fout';
          try {
            const errorJson = JSON.parse(rawText);
            errorMessage = errorJson.error || errorMessage;
          } catch (e) {
            errorMessage = `Server error (${response.status})`;
          }
          setErrors(prev => ({ ...prev, smartMeterFile: errorMessage }));
          return;
        }

        // Als response OK is, parse de ruwe tekst naar JSON
        const res = JSON.parse(rawText);
        console.log("Stap 3: Geparsed JSON resultaat:", res);

        if (res && res.summary) {
          console.log("Stap 4: Summary gevonden, navigeren via onSubmit...");
          
          
          onSubmit({
            ...submitData,
            monthlyConsumption: res.summary.monthlyConsumption,
            smartMeterData: res.summary,
            hourlyAnalytics: res.hourly_analytics || [],
            consumptionSplit: res.consumption_split || {},
            variableCostsTotal: res.summary.variable_costs_total || 0,
            isFromSmartMeter: true
          });
        } else {
          console.error("Stap 4: FOUT - 'summary' ontbreekt in resultaat:", res);
          setErrors(prev => ({ ...prev, smartMeterFile: 'Server stuurde onvolledige data' }));
        }

      } catch (error) {
        console.error("Stap 5: Kritieke Fetch Error:", error);
        setErrors(prev => ({ ...prev, smartMeterFile: 'Backend niet bereikbaar op 127.0.0.1:5001' }));
      }
      return; 
    }

    // ROUTE 3: Handmatige invoer (geen bestand, wel bekend verbruik)
    console.log("Route 3: Handmatige invoer verzenden...");
    onSubmit(submitData);
  } else {
    console.log("Validatie gefaald. Controleer de rode meldingen.");
  }
};
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

                {/* Toon dit veld alleen als er GEEN slimme meter wordt gebruikt */}
                {!formData.hasSmartMeter && (
                  <div className="form-group">
                    <label htmlFor="monthlyConsumption">Maandelijks Elektriciteitsverbruik (kWh) *</label>
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
                )}

                <div className="smart-meter-option">
                  <label htmlFor="hasSmartMeter" className="smart-meter-label">
                    <input
                      type="checkbox"
                      id="hasSmartMeter"
                      name="hasSmartMeter"
                      checked={formData.hasSmartMeter}
                      onChange={handleChange}
                    />
                    <span className="smart-meter-text">
                      {formData.hasSmartMeter 
                        ? "Ik gebruik mijn slimme meter data" 
                        : "Of upload je slimme meter data (CSV/Excel) voor nauwkeurigere analyse"}
                    </span>
                  </label>
                </div>

                {formData.hasSmartMeter && (
                  <div className="form-group">
                    {/* Keuze voor de eenheid (kWh of MWh) */}
                    <label htmlFor="energyUnit">Eenheid in bestand:</label>
                    <select 
                      id="energyUnit" 
                      name="energyUnit" 
                      value={formData.energyUnit || 'kWh'} 
                      onChange={handleChange}
                      style={{ marginBottom: '10px', display: 'block' }}
                    >
                      <option value="kWh">Kilowattuur (kWh)</option>
                      <option value="MWh">Megawattuur (MWh)</option>
                    </select>

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
                  <p className="estimation-value">
                    {formData.energyLabel && formData.householdMembers 
                      ? `${estimateConsumption().toFixed(0)} kWh` 
                      : 'Selecteer label en huishoudgrootte'}
                  </p>
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

export default HomePage;
