import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ComparePage from './pages/ComparePage'
import PersonalDataPage from './pages/PersonalDataPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<PersonalDataPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App