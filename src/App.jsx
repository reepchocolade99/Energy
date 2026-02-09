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
    setCurrentPage('personal')
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
      {currentPage === 'home' ? (
        <HomePage onSubmit={handleHomeSubmit} />
      ) : currentPage === 'personal' ? (
        <PersonalDataPage 
          formData={formData} 
          onGoHome={handleGoHome}
          onSwitchTab={handleSwitchTab}
        />
      ) : (
        <ComparePage formData={formData} onGoHome={handleGoHome} />
      )}
    </div>
  )
}

export default App
