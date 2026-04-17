import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import PersonDetails from '@/components/wizard/PersonDetails'
import Assets from '@/components/wizard/Assets'
import ScenarioScreen from '@/components/scenario/ScenarioScreen'

export default function App() {
  const location = useLocation()
  const locationScenario = location.state?.scenario ?? null
  const initialPeople = locationScenario?.people ?? null
  const [step, setStep] = useState(initialPeople ? 3 : 1)
  const [people, setPeople] = useState(initialPeople ?? [])
  const [capitalEvents, setCapitalEvents] = useState(locationScenario?.capitalEvents ?? [])
  const [scenarioLabel, setScenarioLabel] = useState(locationScenario?.label ?? '')
  const [initialMonthlyIncome, setInitialMonthlyIncome] = useState(locationScenario?.monthlySpendingTarget ?? 3000)
  const [initialSpendingSchedule, setInitialSpendingSchedule] = useState(locationScenario?.spendingSchedule ?? [])

  function handlePersonDetailsComplete(collectedPeople) {
    // Preserve accounts/statePension for people whose name is unchanged
    const merged = collectedPeople.map(newP => {
      const existing = people.find(p => p.name === newP.name)
      return existing ? { ...existing, currentAge: newP.currentAge } : newP
    })
    setPeople(merged)
    setStep(2)
  }

  function handleAssetsComplete({ people: updatedPeople, capitalEvents: updatedEvents, label }) {
    setPeople(updatedPeople)
    setCapitalEvents(updatedEvents ?? [])
    setScenarioLabel(label ?? '')
    setStep(3)
  }

  function handleEditDetails() {
    setStep(1)
  }

  function handleEditAccounts() {
    setStep(2)
  }

  function handlePeopleLoad(loadedPeople) {
    setPeople(loadedPeople)
    setStep(3)
  }

  function handleHouseholdLoad({ capitalEvents: loadedEvents, label: loadedLabel, monthlySpendingTarget, spendingSchedule: loadedSchedule }) {
    setCapitalEvents(loadedEvents ?? [])
    setScenarioLabel(loadedLabel ?? '')
    if (monthlySpendingTarget != null) setInitialMonthlyIncome(monthlySpendingTarget)
    if (loadedSchedule != null) setInitialSpendingSchedule(loadedSchedule)
  }

  if (step === 1) {
    return (
      <PersonDetails
        initialPeople={people}
        onComplete={handlePersonDetailsComplete}
        onPeopleLoad={handlePeopleLoad}
        onHouseholdLoad={handleHouseholdLoad}
      />
    )
  }

  if (step === 2) {
    return (
      <Assets
        people={people}
        capitalEvents={capitalEvents}
        scenarioLabel={scenarioLabel}
        onComplete={handleAssetsComplete}
        onBack={() => setStep(1)}
      />
    )
  }

  return (
    <ScenarioScreen
      people={people}
      capitalEvents={capitalEvents}
      scenarioLabel={scenarioLabel}
      initialMonthlyIncome={initialMonthlyIncome}
      initialSpendingSchedule={initialSpendingSchedule}
      onEditDetails={handleEditDetails}
      onEditAccounts={handleEditAccounts}
      onPeopleLoad={handlePeopleLoad}
      onHouseholdLoad={handleHouseholdLoad}
    />
  )
}
