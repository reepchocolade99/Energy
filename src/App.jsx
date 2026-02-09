import { useState } from 'react'
import HomePage from './pages/HomePage'
import ComparePage from './pages/ComparePage'
import PersonalDataPage from './pages/PersonalDataPage'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [formData, setFormData] = useState(null)

  const handleHomeSubmit = (data) => {
    setFormData(data)
    
    // DE LOGICA: Hebben we slimme meter data?
    if (data.isFromSmartMeter) {
      // Ja -> Toon eerst de grafieken (Inzicht)
      setCurrentPage('personal')
    } else {
      // Nee -> Ga direct naar de vergelijker
      setCurrentPage('compare')
    }
  }

  const handleGoHome = () => {
    setCurrentPage('home')
    setFormData(null)
  }

  const handleSwitchTab = () => {
    setCurrentPage('compare')
  }

  return (
    <div className="app">
      {currentPage === 'home' && (
        <HomePage onSubmit={handleHomeSubmit} />
      )}
      
      {currentPage === 'personal' && (
        <PersonalDataPage 
          formData={formData} 
          onGoHome={handleGoHome}
          onSwitchTab={handleSwitchTab}
        />
      )}
      
      {currentPage === 'compare' && (
        <ComparePage 
          formData={formData} 
          onGoHome={handleGoHome} 
        />
      )}
    </div>
  )
}
export default App
