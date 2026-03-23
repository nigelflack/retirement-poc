import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import PersonDetails from '@/components/wizard/PersonDetails'
import Assets from '@/components/wizard/Assets'
import ScenarioScreen from '@/components/scenario/ScenarioScreen'

export default function App() {
  const location = useLocation()
  const initialPeople = location.state?.people ?? null
  const [step, setStep] = useState(initialPeople ? 3 : 1)
  const [people, setPeople] = useState(initialPeople ?? [])

  function handlePersonDetailsComplete(collectedPeople) {
    setPeople(collectedPeople)
    setStep(2)
  }

  function handleAssetsComplete(peopleWithAssets) {
    setPeople(peopleWithAssets)
    setStep(3)
  }

  function handleEditDetails() {
    setPeople([])
    setStep(1)
  }

  if (step === 1) {
    return <PersonDetails onComplete={handlePersonDetailsComplete} />
  }

  if (step === 2) {
    return (
      <Assets
        people={people}
        onComplete={handleAssetsComplete}
        onBack={() => setStep(1)}
      />
    )
  }

  return (
    <ScenarioScreen
      people={people}
      onEditDetails={handleEditDetails}
    />
  )
}
