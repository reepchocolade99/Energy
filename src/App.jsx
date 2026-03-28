import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import ComparePage from './pages/ComparePage'
import PersonalDataPage from './pages/PersonalDataPage'
import OverviewPage from './pages/OverviewPage'
import './App.css'

function App() {
  const [formData, setFormData] = useState(null)

  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/personal" element={
            <PersonalDataPage
              formData={formData}
              onGoHome={() => window.location.href = '/'}
              onSwitchTab={() => window.location.href = '/compare'}
            />
          } />
          <Route path="/compare" element={
            <ComparePage
              formData={formData}
              onGoBack={() => window.location.href = '/'}
              onGoHome={() => window.location.href = '/'}
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App