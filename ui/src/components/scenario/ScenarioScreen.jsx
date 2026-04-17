import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { callRun, callSolveIncome, callSolveAges } from '@/api/run'
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

// --- Panel placeholder (Panel 4) ---
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

// --- Panel 2 slot (income or ages result) ---
function Panel2Slot({ title, loading, data, type }) {
  return (
    <div className="flex-1 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 rounded-md bg-muted animate-pulse" />
          <div className="h-4 rounded-md bg-muted animate-pulse w-3/4" />
        </div>
      ) : !data ? null : data.unavailable ? (
        <p className="text-sm text-muted-foreground italic">Not available at this setting</p>
      ) : type === 'income' ? (
        <p className="text-2xl font-semibold">
          {formatCurrency(data.monthlyIncome)}
          <span className="text-sm font-normal text-muted-foreground"> /mo</span>
        </p>
      ) : (
        <div className="space-y-0.5">
          {data.retirementAges.map(r => (
            <p key={r.name} className="text-sm">
              <span className="font-semibold">{r.name}</span>{' '}
              <span className="text-muted-foreground">retires at</span>{' '}
              <span className="font-semibold">{r.retirementAge}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Panel 3 scenario card ---
function ScenarioCard({ card, people, onClick }) {
  return (
    <div
      className={cn(
        'flex-1 rounded-lg border p-4 space-y-2 cursor-pointer transition-colors hover:border-primary',
        card.highlighted ? 'border-primary bg-primary/5' : 'bg-card',
      )}
      onClick={onClick}
    >
      {card.label && (
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">{card.label}</p>
      )}
      <div>
        {people.map(p => (
          <p key={p.name} className="text-sm">
            <span className="font-medium">{p.name}</span>{' '}
            <span className="font-semibold">{card.ages[p.name]}</span>
          </p>
        ))}
      </div>
      <p className="text-xl font-semibold">
        {formatCurrency(card.monthlyIncome)}
        <span className="text-sm font-normal text-muted-foreground"> /mo</span>
      </p>
      <p className="text-xs text-muted-foreground">to age 90+</p>
    </div>
  )
}

function validatePeopleFile(data) {
  if (!data || !Array.isArray(data.people) || data.people.length === 0) return false
  return data.people.every(p =>
    typeof p.name === 'string' && p.name.trim() &&
    typeof p.currentAge === 'number' &&
    Array.isArray(p.accounts) && p.accounts.length > 0,
  )
}

export default function ScenarioScreen({ people, capitalEvents, scenarioLabel, initialMonthlyIncome = 3000, initialSpendingSchedule = [], onEditDetails, onEditAccounts, onPeopleLoad, onHouseholdLoad }) {
  const hasPartner = people.length > 1
  const primary = people[0]
  const partner = people[1] ?? null

  // Scenario params
  const defaultRetirementAges = Object.fromEntries(
    people.map(p => [p.name, typeof p.retirementAge === 'number' ? p.retirementAge : Math.min(p.currentAge + 10, 65)])
  )
  const [retirementAges, setRetirementAges] = useState(defaultRetirementAges)
  const [monthlyIncome, setMonthlyIncome] = useState(initialMonthlyIncome)
  const [retireTogether, setRetireTogether] = useState(false)

  // Simulation state
  const [lastResult, setLastResult] = useState(null)
  const [lastRunAges, setLastRunAges] = useState(defaultRetirementAges)
  const [lastRunIncome, setLastRunIncome] = useState(initialMonthlyIncome)
  const [lastP50, setLastP50] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Panel 2 / Panel 3 state
  const [p2Status, setP2Status] = useState('idle') // 'idle' | 'loading' | 'done'
  const [p2Bucket, setP2Bucket] = useState(null)   // 'low' | 'high'
  const [p2Left, setP2Left] = useState(null)
  const [p2Right, setP2Right] = useState(null)
  const [p3Mid, setP3Mid] = useState(null)          // extra solve/income for low-bucket middle card

  // Spending schedule state (full list, replaces step-change)
  const [spendingSchedule, setSpendingSchedule] = useState(initialSpendingSchedule)
  const [spendingScheduleOpen, setSpendingScheduleOpen] = useState(initialSpendingSchedule.length > 0)

  // Load/save state
  const [loadError, setLoadError] = useState(null)
  const fileInputRef = useRef(null)

  // Previous values to revert to on error
  const prevRetirementAges = useRef(defaultRetirementAges)
  const prevMonthlyIncome = useRef(initialMonthlyIncome)
  const debounceTimer = useRef(null)
  const p2RunIdRef = useRef(0)

  // Build the POST /simulate payload
  const buildPayload = useCallback((ages, income) => {
    const payload = {
      people: people.map(p => ({ ...p, retirementAge: ages[p.name] })),
      monthlySpendingTarget: income,
      toAge: 100,
      debug: true,
    }
    if (spendingSchedule.length > 0) {
      payload.spendingSchedule = spendingSchedule
    }
    if (capitalEvents && capitalEvents.length > 0) payload.capitalEvents = capitalEvents
    if (scenarioLabel) payload.label = scenarioLabel
    return payload
  }, [people, spendingSchedule, capitalEvents, scenarioLabel])

  const runSimulation = useCallback(async (ages, income, p50) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await callRun(buildPayload(ages, income))
      setLastResult(result)
      setLastRunAges(ages)
      setLastRunIncome(income)
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

  // Fire Panel 2 solve calls after every successful run
  useEffect(() => {
    if (!lastResult) return
    const ages = prevRetirementAges.current
    const income = prevMonthlyIncome.current
    const runId = ++p2RunIdRef.current
    const solventAt90 = interpolateSolventAt(lastResult.survivalTable, 90)
    const isLow = solventAt90 == null || solventAt90 < 0.85

    setP2Bucket(isLow ? 'low' : 'high')
    setP2Status('loading')
    setP2Left(null)
    setP2Right(null)
    setP3Mid(null)

    const peopleWithAges = people.map(p => ({ ...p, retirementAge: ages[p.name] }))

    async function compute() {
      if (isLow) {
        const [leftRes, rightRes] = await Promise.allSettled([
          callSolveIncome({ people: peopleWithAges, toAge: 100, targetSolvencyPct: 0.85, referenceAge: 90 }),
          callSolveAges({ people: peopleWithAges, monthlyIncome: income, toAge: 100, targetSolvencyPct: 0.85, referenceAge: 90 }),
        ])
        if (p2RunIdRef.current !== runId) return
        const left = leftRes.status === 'fulfilled' ? leftRes.value : { unavailable: true }
        const right = rightRes.status === 'fulfilled' ? rightRes.value : { unavailable: true }
        setP2Left(left)
        setP2Right(right)
        setP2Status('done')
        // Panel 3 middle card: one extra solve/income at mid-point ages
        if (leftRes.status === 'fulfilled' && rightRes.status === 'fulfilled') {
          const midPeople = people.map(p => {
            const reqAge = right.retirementAges.find(r => r.name === p.name)?.retirementAge ?? ages[p.name]
            const raw = Math.round((ages[p.name] + reqAge) / 2)
            return { ...p, retirementAge: Math.max(Math.min(raw, 80), p.currentAge + 1) }
          })
          try {
            const midResult = await callSolveIncome({ people: midPeople, toAge: 100, targetSolvencyPct: 0.85, referenceAge: 90 })
            if (p2RunIdRef.current !== runId) return
            setP3Mid(midResult)
          } catch {
            if (p2RunIdRef.current !== runId) return
            setP3Mid({ unavailable: true })
          }
        }
      } else {
        const earlierPeople = people.map(p => ({
          ...p,
          retirementAge: Math.max(ages[p.name] - 2, p.currentAge + 1),
        }))
        const [leftRes, rightRes] = await Promise.allSettled([
          callSolveIncome({ people: earlierPeople, toAge: 100, targetSolvencyPct: 0.85, referenceAge: 90 }),
          callSolveAges({ people: peopleWithAges, monthlyIncome: income * 1.2, toAge: 100, targetSolvencyPct: 0.85, referenceAge: 90 }),
        ])
        if (p2RunIdRef.current !== runId) return
        setP2Left(leftRes.status === 'fulfilled' ? leftRes.value : { unavailable: true })
        setP2Right(rightRes.status === 'fulfilled' ? rightRes.value : { unavailable: true })
        setP2Status('done')
      }
    }

    compute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResult])

  // Save / Load handlers
  function handleSave() {
    const data = {
      people: people.map(p => ({ ...p, retirementAge: retirementAges[p.name] })),
      monthlySpendingTarget: monthlyIncome,
    }
    if (scenarioLabel) data.label = scenarioLabel
    if (spendingSchedule.length > 0) data.spendingSchedule = spendingSchedule
    if (capitalEvents && capitalEvents.length > 0) data.capitalEvents = capitalEvents
    const filename = people.map(p => p.name.toLowerCase().replace(/\s+/g, '-')).join('-') + '.json'
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleLoadClick() {
    setLoadError(null)
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!validatePeopleFile(data)) {
          setLoadError('Could not load file — invalid format.')
          return
        }
        onPeopleLoad(data.people)
        // Restore retirement ages
        const loadedAges = Object.fromEntries(
          data.people.map(p => [
            p.name,
            typeof p.retirementAge === 'number' ? p.retirementAge : Math.min(p.currentAge + 10, 65),
          ])
        )
        setRetirementAges(loadedAges)
        prevRetirementAges.current = loadedAges
        // Restore spending target
        if (typeof data.monthlySpendingTarget === 'number') {
          setMonthlyIncome(data.monthlySpendingTarget)
        }
        // Restore spending schedule
        if (Array.isArray(data.spendingSchedule) && data.spendingSchedule.length > 0) {
          setSpendingSchedule(data.spendingSchedule)
          setSpendingScheduleOpen(true)
        } else {
          setSpendingSchedule([])
        }
        // Restore household fields (capital events, label)
        onHouseholdLoad({
          capitalEvents: data.capitalEvents ?? [],
          label: data.label ?? '',
        })
      } catch {
        setLoadError('Could not load file — invalid format.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  function handleCardClick(card) {
    const newAges = { ...retirementAges, ...card.ages }
    const newIncome = Math.round(card.monthlyIncome)
    setRetirementAges(newAges)
    setMonthlyIncome(newIncome)
    scheduleRun(newAges, newIncome)
  }

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

  // Build Panel 3 cards from Panel 2 results
  function getPanel3Cards() {
    if (p2Status !== 'done' || !p2Left || !p2Right) return []
    const ages = lastRunAges
    const income = lastRunIncome
    const cards = []
    if (p2Bucket === 'low') {
      if (!p2Left.unavailable) {
        cards.push({
          ages: Object.fromEntries(people.map(p => [p.name, ages[p.name]])),
          monthlyIncome: p2Left.monthlyIncome,
          highlighted: false,
        })
      }
      if (!p2Right.unavailable && p3Mid && !p3Mid.unavailable) {
        const midAges = Object.fromEntries(people.map(p => {
          const reqAge = p2Right.retirementAges.find(r => r.name === p.name)?.retirementAge ?? ages[p.name]
          const raw = Math.round((ages[p.name] + reqAge) / 2)
          return [p.name, Math.max(Math.min(raw, 80), p.currentAge + 1)]
        }))
        cards.push({ ages: midAges, monthlyIncome: p3Mid.monthlyIncome, highlighted: false })
      }
      if (!p2Right.unavailable) {
        cards.push({
          ages: Object.fromEntries(p2Right.retirementAges.map(r => [r.name, r.retirementAge])),
          monthlyIncome: income,
          highlighted: false,
        })
      }
    } else {
      if (!p2Left.unavailable) {
        cards.push({
          ages: Object.fromEntries(people.map(p => [p.name, Math.max(ages[p.name] - 2, p.currentAge + 1)])),
          monthlyIncome: p2Left.monthlyIncome,
          highlighted: false,
        })
      }
      cards.push({
        ages: Object.fromEntries(people.map(p => [p.name, ages[p.name]])),
        monthlyIncome: income,
        highlighted: true,
        label: 'your current plan',
      })
      if (!p2Right.unavailable) {
        cards.push({
          ages: Object.fromEntries(p2Right.retirementAges.map(r => [r.name, r.retirementAge])),
          monthlyIncome: income * 1.2,
          highlighted: false,
        })
      }
    }
    return cards
  }

  // Derived values from result
  const solvencyPct = lastResult
    ? Math.round((1 - lastResult.probabilityOfRuin) * 100)
    : null
  const survivalAt90 = interpolateSolventAt(lastResult?.survivalTable, 90)
  const medianPot = lastResult?.accumulationSnapshot?.real?.p50 ?? null

  const navigate = useNavigate()

  const headerName = hasPartner
    ? `${primary.name} (${primary.currentAge}) and ${partner.name} (${partner.currentAge})`
    : `${primary.name} (${primary.currentAge})`

  const p2LeftTitle = p2Bucket === 'low' ? 'Sustainable income now' : 'Retire 2 years earlier'
  const p2RightTitle = p2Bucket === 'low' ? 'Working until…' : 'To afford +20% more'
  const panel3Cards = getPanel3Cards()

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="w-full max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-medium text-foreground">{headerName}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onEditDetails}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              [Edit details]
            </button>
            <button
              onClick={onEditAccounts}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              [Edit accounts]
            </button>
            <button
              onClick={handleSave}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              [Save]
            </button>
            <button
              onClick={handleLoadClick}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              [Load]
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
        {loadError && (
          <p className="text-xs text-destructive">{loadError}</p>
        )}

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

                {/* Spending schedule */}
                <div className="pt-1 text-xs">
                  <button
                    className="text-primary hover:underline underline-offset-2"
                    onClick={() => setSpendingScheduleOpen(o => !o)}
                    disabled={isLoading}
                  >
                    {spendingScheduleOpen ? '▲' : '▼'} Spending schedule
                  </button>
                  {spendingScheduleOpen && (
                    <div className="mt-2 space-y-2 text-left">
                      {spendingSchedule.length > 0 && (
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 text-muted-foreground mb-1">
                          <span>From year</span>
                          <span>Monthly (£)</span>
                          <span>Label</span>
                          <span />
                        </div>
                      )}
                      {spendingSchedule.map((s, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 items-center">
                          <Input
                            type="number"
                            min={0}
                            className="text-xs h-7"
                            placeholder="e.g. 10"
                            value={s.fromYearsFromRetirement}
                            onChange={e => {
                              const updated = spendingSchedule.map((x, i) => i === idx ? { ...x, fromYearsFromRetirement: e.target.value } : x)
                              setSpendingSchedule(updated)
                              scheduleRun(retirementAges, monthlyIncome)
                            }}
                            disabled={isLoading}
                          />
                          <Input
                            type="number"
                            min={0}
                            className="text-xs h-7"
                            placeholder="e.g. 2000"
                            value={s.monthlyAmount}
                            onChange={e => {
                              const updated = spendingSchedule.map((x, i) => i === idx ? { ...x, monthlyAmount: e.target.value } : x)
                              setSpendingSchedule(updated)
                              scheduleRun(retirementAges, monthlyIncome)
                            }}
                            disabled={isLoading}
                          />
                          <Input
                            type="text"
                            className="text-xs h-7"
                            placeholder="optional"
                            value={s.label ?? ''}
                            onChange={e => {
                              const updated = spendingSchedule.map((x, i) => i === idx ? { ...x, label: e.target.value } : x)
                              setSpendingSchedule(updated)
                            }}
                            disabled={isLoading}
                          />
                          <button
                            className="text-muted-foreground hover:text-destructive px-1"
                            onClick={() => {
                              const updated = spendingSchedule.filter((_, i) => i !== idx)
                              setSpendingSchedule(updated)
                              scheduleRun(retirementAges, monthlyIncome)
                            }}
                            disabled={isLoading}
                          >✕</button>
                        </div>
                      ))}
                      <button
                        className="text-primary hover:underline underline-offset-2"
                        onClick={() => setSpendingSchedule(prev => [...prev, { fromYearsFromRetirement: '', monthlyAmount: '', label: '' }])}
                        disabled={isLoading}
                      >+ Add step</button>
                    </div>
                  )}
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
              {lastResult && (
                <div className="pt-1 text-center">
                  <button
                    className="text-xs text-primary hover:underline underline-offset-2"
                    onClick={() => navigate('/detail', {
                      state: { result: lastResult, people, capitalEvents, retirementAges, monthlyIncome },
                    })}
                  >
                    View detailed breakdown →
                  </button>
                </div>
              )}
            </div>

            {/* Error state */}
            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Panel 2 — Other options */}
        {p2Status !== 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Other options you could consider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <Panel2Slot
                  title={p2LeftTitle}
                  loading={p2Status === 'loading'}
                  data={p2Left}
                  type="income"
                />
                <div className="w-px bg-border self-stretch" />
                <Panel2Slot
                  title={p2RightTitle}
                  loading={p2Status === 'loading'}
                  data={p2Right}
                  type="ages"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Panel 3 — Scenario cards */}
        {panel3Cards.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Some options that might work for you</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {panel3Cards.map((card, i) => (
                  <ScenarioCard key={i} card={card} people={people} onClick={() => handleCardClick(card)} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Panel 4 — placeholder */}
        <PanelPlaceholder title="Or, adjust your plan to improve your projection" />
      </div>
    </div>
  )
}
