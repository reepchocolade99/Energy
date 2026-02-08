import { useState } from 'react'
import HomePage from './pages/HomePage'
import ComparePage from './pages/ComparePage'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [formData, setFormData] = useState(null)

  const handleHomeSubmit = (data) => {
    setFormData(data)
    setCurrentPage('compare')
  }

  const handleGoHome = () => {
    setCurrentPage('home')
  }

  return (
    <div className="app">
      {currentPage === 'home' ? (
        <HomePage onSubmit={handleHomeSubmit} />
      ) : (
        <ComparePage formData={formData} onGoHome={handleGoHome} />
      )}
    </div>
  )
}

export default App
