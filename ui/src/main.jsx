import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import ScenariosPage from './pages/ScenariosPage.jsx'
import DetailPage from './pages/DetailPage.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/scenarios" replace />} />
        <Route path="/scenario" element={<App />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/detail" element={<DetailPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
