import { useState } from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import ScenarioScreen from '@/components/scenario/ScenarioScreen'

export default function App() {
  const location = useLocation()
  const locationScenario = location.state?.scenario ?? null
  const [scenario, setScenario] = useState(locationScenario)

  function handleScenarioLoad(loadedScenario) {
    setScenario(loadedScenario)
  }

  if (!scenario) {
    return <Navigate to="/scenarios" replace />
  }

  return (
    <ScenarioScreen
      scenario={scenario}
      onScenarioLoad={handleScenarioLoad}
    />
  )
}
