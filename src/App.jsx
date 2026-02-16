import { useState } from 'react'
import HomePage from './pages/HomePage'
import ComparePage from './pages/ComparePage'
import PersonalDataPage from './pages/PersonalDataPage'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [formData, setFormData] = useState(null)

  /**
   * Stap 1: De inzending vanaf de Homepagina verwerken
   * Hier maken we het onderscheid tussen CSV-upload en Handmatige invoer.
   */
  const handleHomeSubmit = (data) => {
    // We creëren een verrijkt object zodat we later weten of we de 
    // variabele kaart moeten tonen of niet.
    const enrichedData = {
      ...data,
      // Alleen variabele kosten meenemen als we écht een slimme meter bestand hebben.
      // Bij handmatige invoer (gokwaarde) dwingen we dit op 0.
      variableCostsTotal: data.isFromSmartMeter ? data.variableCostsTotal : 0,
      isFromSmartMeter: !!data.isFromSmartMeter,
      // Het verbruik komt of uit de CSV berekening of uit het tekstveld
      monthlyConsumption: data.monthlyConsumption || 0
    }

    console.log("App.jsx: Data opgeslagen", enrichedData);
    setFormData(enrichedData)
    
    // Navigatie-besluit
    if (enrichedData.isFromSmartMeter) {
      // Prioriteit 1: Bestand geüpload -> Eerst naar de grafieken
      setCurrentPage('personal')
    } else {
      // Prioriteit 2: Handmatig -> Direct naar de vaste contracten
      setCurrentPage('compare')
    }
  }

  /**
   * Stap 2: Volledig terug naar start
   * Gebruikt voor de knop "Gegevens bewerken" of "Nieuwe analyse"
   */
  const handleGoHome = () => {
    setFormData(null)
    setCurrentPage('home')
  }

  /**
   * Stap 3: Schakelen tussen Profiel en Vergelijker
   * Zorgt ervoor dat formData behouden blijft in het geheugen.
   */
  const handleBackToPersonal = () => {
    setCurrentPage('personal')
  }

  const handleSwitchTab = () => {
    setCurrentPage('compare')
  }

  return (
    <div className="app">
      {/* 1. STARTPAGINA: Invoer van verbruik of uploaden van CSV */}
      {currentPage === 'home' && (
        <HomePage onSubmit={handleHomeSubmit} />
      )}
      
      {/* 2. ANALYSEPAGINA: Inzicht in uuraantallen (alleen bij CSV) */}
      {currentPage === 'personal' && (
        <PersonalDataPage 
          formData={formData} 
          onGoHome={handleGoHome}       // Terug naar start (wis data)
          onSwitchTab={handleSwitchTab} // Door naar vergelijken
        />
      )}
      
      {/* 3. VERGELIJKINGSPAGINA: De lijst met energiecontracten */}
      {currentPage === 'compare' && (
        <ComparePage 
          formData={formData} 
          onGoBack={formData?.isFromSmartMeter ? handleBackToPersonal : handleGoHome} 
          onGoHome={handleGoHome} 
        />
      )}
    </div>
  )
}

export default App