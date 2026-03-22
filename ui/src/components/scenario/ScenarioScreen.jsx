import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { callRun } from '@/api/run'
import { formatCurrency, cn } from '@/lib/utils'

// --- Interpolate probabilitySolvent at a target age from the survival table ---
function interpolateSolventAt(survivalTable, targetAge) {
  if (!survivalTable || survivalTable.length === 0) return null
  const exact = survivalTable.find(e => e.age === targetAge)
  if (exact) return exact.probabilitySolvent
  const below = [...survivalTable].reverse().find(e => e.age < targetAge)
  const above = survivalTable.find(e => e.age > targetAge)
  if (!below) return above.probabilitySolvent
  if (!above) return below.probabilitySolvent
  const t = (targetAge - below.age) / (above.age - below.age)
  return below.probabilitySolvent + t * (above.probabilitySolvent - below.probabilitySolvent)
}

// --- Solvency bar label ---
function solvencyLabel(probabilitySolventAt90) {
  if (probabilitySolventAt90 == null) return null
  if (probabilitySolventAt90 < 0.5)
    return "At these settings, your money is likely to run out before your 90s."
  if (probabilitySolventAt90 < 0.85)
    return "At these settings, there's a reasonable chance your money lasts into your 90s."
  if (probabilitySolventAt90 <= 0.95)
    return "At these settings, money is likely to last into your 90s."
  return "At these settings, your money is very likely to last well into your 90s."
}

// --- Age spinner ---
function AgeSpinner({ label, value, onChange, min, max, disabled }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <button
        className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-lg"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label} retirement age`}
      >↑</button>
      <div className="border rounded-md w-16 h-10 flex items-center justify-center text-sm font-semibold">
        {value}
      </div>
      <button
        className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-lg"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label} retirement age`}
      >↓</button>
    </div>
  )
}

// --- Panel placeholder ---
function PanelPlaceholder({ title }) {
  return (
    <Card className="opacity-50">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground italic">Not yet available.</p>
      </CardContent>
    </Card>
  )
}

export default function ScenarioScreen({ people, onEditDetails }) {
  const hasPartner = people.length > 1
  const primary = people[0]
  const partner = people[1] ?? null

  // Scenario params
  const defaultRetirementAges = Object.fromEntries(
    people.map(p => [p.name, Math.min(p.currentAge + 10, 65)])
  )
  const [retirementAges, setRetirementAges] = useState(defaultRetirementAges)
  const [monthlyIncome, setMonthlyIncome] = useState(3000)
  const [retireTogether, setRetireTogether] = useState(false)

  // Simulation state
  const [lastResult, setLastResult] = useState(null)
  const [lastP50, setLastP50] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Previous values to revert to on error
  const prevRetirementAges = useRef(defaultRetirementAges)
  const prevMonthlyIncome = useRef(3000)
  const debounceTimer = useRef(null)

  // Build the POST /run payload
  const buildPayload = useCallback((ages, income, p50) => {
    const withdrawalRate = p50 && p50 > 0
      ? Math.min(Math.max((income * 12) / p50, 0.001), 0.99)
      : 0.04
    return {
      people: people.map(p => ({
        ...p,
        retirementAge: ages[p.name],
      })),
      withdrawalRate,
      toAge: 100,
    }
  }, [people])

  const runSimulation = useCallback(async (ages, income, p50) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await callRun(buildPayload(ages, income, p50))
      setLastResult(result)
      setLastP50(result.accumulationSnapshot?.real?.p50 ?? null)
      prevRetirementAges.current = ages
      prevMonthlyIncome.current = income
    } catch (err) {
      setError(err.message)
      setRetirementAges(prevRetirementAges.current)
      setMonthlyIncome(prevMonthlyIncome.current)
    } finally {
      setIsLoading(false)
    }
  }, [buildPayload])

  // Debounced trigger on any control change
  const scheduleRun = useCallback((ages, income) => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      runSimulation(ages, income, lastP50)
    }, 400)
  }, [runSimulation, lastP50])

  // Run on mount
  useEffect(() => {
    runSimulation(retirementAges, monthlyIncome, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handlers
  function handleAgeChange(personName, newAge) {
    let newAges = { ...retirementAges, [personName]: newAge }
    if (retireTogether && personName === primary.name && partner) {
      const yearsFromNow = newAge - primary.currentAge
      newAges[partner.name] = Math.min(Math.max(partner.currentAge + yearsFromNow, partner.currentAge + 1), 80)
    }
    setRetirementAges(newAges)
    scheduleRun(newAges, monthlyIncome)
  }

  function handleIncomeChange(value) {
    const income = parseInt(value, 10) || 0
    setMonthlyIncome(income)
    scheduleRun(retirementAges, income)
  }

  function handleRetireToggle(checked) {
    setRetireTogether(checked)
    if (checked && partner) {
      const yearsFromNow = retirementAges[primary.name] - primary.currentAge
      const newPartnerAge = Math.min(Math.max(partner.currentAge + yearsFromNow, partner.currentAge + 1), 80)
      const newAges = { ...retirementAges, [partner.name]: newPartnerAge }
      setRetirementAges(newAges)
      scheduleRun(newAges, monthlyIncome)
    }
  }

  // Derived values from result
  const solvencyPct = lastResult
    ? Math.round((1 - lastResult.probabilityOfRuin) * 100)
    : null
  const survivalAt90 = interpolateSolventAt(lastResult?.survivalTable, 90)
  const medianPot = lastResult?.accumulationSnapshot?.real?.p50 ?? null

  const headerName = hasPartner
    ? `${primary.name} (${primary.currentAge}) and ${partner.name} (${partner.currentAge})`
    : `${primary.name} (${primary.currentAge})`

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="w-full max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{headerName}</span>
          <button
            onClick={onEditDetails}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            [Edit details]
          </button>
        </div>

        {/* Panel 1 — Your Retirement Goal */}
        <Card className={cn(isLoading && 'opacity-60 pointer-events-none')}>
          <CardHeader>
            <CardTitle className="text-base text-center">Your Retirement Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-6">
              {/* Left: retirement age spinners */}
              <div className="flex-1 space-y-3">
                <span className="text-sm font-medium text-muted-foreground block text-center">Retire at</span>
                <div className="flex justify-center gap-6">
                  <AgeSpinner
                    label={primary.name}
                    value={retirementAges[primary.name]}
                    onChange={v => handleAgeChange(primary.name, v)}
                    min={primary.currentAge + 1}
                    max={80}
                    disabled={isLoading}
                  />
                  {hasPartner && (
                    <AgeSpinner
                      label={partner.name}
                      value={retirementAges[partner.name]}
                      onChange={v => handleAgeChange(partner.name, v)}
                      min={partner.currentAge + 1}
                      max={80}
                      disabled={isLoading || retireTogether}
                    />
                  )}
                </div>
                {hasPartner && (
                  <div className="flex items-center justify-center space-x-2 pt-1">
                    <Checkbox
                      id="retireTogether"
                      checked={retireTogether}
                      onCheckedChange={handleRetireToggle}
                      disabled={isLoading}
                    />
                    <Label htmlFor="retireTogether" className="cursor-pointer text-sm">Retire together</Label>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px bg-border self-stretch" />

              {/* Right: income */}
              <div className="flex-1 space-y-3">
                <span className="text-sm font-medium text-muted-foreground block text-center">With an income of</span>
                <div className="flex flex-col items-center gap-1">
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-lg"
                    onClick={() => handleIncomeChange(monthlyIncome + 100)}
                    disabled={isLoading}
                    aria-label="Increase income"
                  >↑</button>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">£</span>
                    <Input
                      type="number"
                      min={0}
                      className="w-28 text-center font-semibold"
                      value={monthlyIncome}
                      onChange={e => handleIncomeChange(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-lg"
                    onClick={() => handleIncomeChange(Math.max(0, monthlyIncome - 100))}
                    disabled={isLoading}
                    aria-label="Decrease income"
                  >↓</button>
                  <span className="text-xs text-muted-foreground">per month</span>
                </div>
              </div>
            </div>

            {/* Projected pot sentence */}
            {medianPot != null && (
              <p className="text-sm text-muted-foreground text-center">
                Your current savings are projected to grow to about{' '}
                <span className="font-semibold text-foreground">{formatCurrency(medianPot)}</span>{' '}
                by the time you retire. (in today&apos;s money)
              </p>
            )}

            {/* Solvency bar */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Will your money last?</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Unlikely</span>
                <span>Very likely</span>
              </div>
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                {solvencyPct != null && (
                  <div
                    className="absolute top-0 bottom-0 left-0 rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${solvencyPct}%` }}
                  />
                )}
              </div>
              {survivalAt90 != null && (
                <p className="text-sm text-muted-foreground text-center italic">
                  {solvencyLabel(survivalAt90)}
                </p>
              )}
            </div>

            {/* Loading / error states */}
            {isLoading && (
              <p className="text-xs text-muted-foreground text-center animate-pulse">Calculating…</p>
            )}
            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Panels 2–4 — placeholders */}
        <PanelPlaceholder title="Other options you could consider" />
        <PanelPlaceholder title="Some options that might work for you" />
        <PanelPlaceholder title="Or, adjust your plan to improve your projection" />
      </div>
    </div>
  )
}
