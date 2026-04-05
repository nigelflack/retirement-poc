import { useState, useEffect, useRef, useCallback } from 'react'
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

// --- Format large currency values as abbreviated strings for the breakdown track ---
function fmtSnapK(n) {
  if (n == null) return '\u2014'
  if (n >= 1_000_000) return `\u00a3${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `\u00a3${Math.round(n / 1_000)}k`
  return `\u00a3${Math.round(n)}`
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

export default function ScenarioScreen({ people, onEditDetails, onEditAccounts, onPeopleLoad }) {
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
  const [lastRunAges, setLastRunAges] = useState(defaultRetirementAges)
  const [lastRunIncome, setLastRunIncome] = useState(3000)
  const [lastP50, setLastP50] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Panel 2 / Panel 3 state
  const [p2Status, setP2Status] = useState('idle') // 'idle' | 'loading' | 'done'
  const [p2Bucket, setP2Bucket] = useState(null)   // 'low' | 'high'
  const [p2Left, setP2Left] = useState(null)
  const [p2Right, setP2Right] = useState(null)
  const [p3Mid, setP3Mid] = useState(null)          // extra solve/income for low-bucket middle card

  // Breakdown / debug panel toggle state (persists across re-runs)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  // Step-change state (per-person contribution steps)
  const [contribStepOpen, setContribStepOpen] = useState({})      // { personName: bool }
  const [contribReducesTo, setContribReducesTo] = useState({})    // { personName: number|'' }
  const [contribLastYears, setContribLastYears] = useState({})    // { personName: number|'' }

  // Step-change state (household income step)
  const [incomeStepOpen, setIncomeStepOpen] = useState(false)
  const [incomeReducesTo, setIncomeReducesTo] = useState('')
  const [incomeAfterYear, setIncomeAfterYear] = useState('')

  // Capital events loaded from file (passthrough)
  const [loadedCapitalEvents, setLoadedCapitalEvents] = useState(null)

  // Load/save state
  const [loadError, setLoadError] = useState(null)
  const fileInputRef = useRef(null)

  // Previous values to revert to on error
  const prevRetirementAges = useRef(defaultRetirementAges)
  const prevMonthlyIncome = useRef(3000)
  const debounceTimer = useRef(null)
  const p2RunIdRef = useRef(0)

  // Build the POST /simulate payload
  const buildPayload = useCallback((ages, income) => {
    const payload = {
      people: people.map(p => {
        const person = { ...p, retirementAge: ages[p.name] }
        const reducesTo = contribReducesTo[p.name]
        const lastYears = contribLastYears[p.name]
        const yearsToRetirement = ages[p.name] - p.currentAge
        if (reducesTo !== '' && reducesTo !== undefined && lastYears !== '' && lastYears !== undefined && Number(lastYears) < yearsToRetirement) {
          const flatMonthly = p.accounts.reduce((s, a) => s + (a.monthlyContribution || 0), 0)
          person.contributionSchedule = [
            { fromYearsFromToday: 0, monthlyAmount: flatMonthly },
            { fromYearsFromToday: yearsToRetirement - Number(lastYears), monthlyAmount: Number(reducesTo) },
          ]
        }
        return person
      }),
      monthlyIncomeTarget: income,
      toAge: 100,
    }
    if (incomeReducesTo !== '' && incomeAfterYear !== '' && Number(incomeReducesTo) < income) {
      payload.incomeSchedule = [
        { fromYearsFromRetirement: 0, monthlyAmount: income },
        { fromYearsFromRetirement: Number(incomeAfterYear), monthlyAmount: Number(incomeReducesTo) },
      ]
    }
    if (loadedCapitalEvents) payload.capitalEvents = loadedCapitalEvents
    return payload
  }, [people, contribReducesTo, contribLastYears, incomeReducesTo, incomeAfterYear, loadedCapitalEvents])

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
    const data = { people, monthlyIncomeTarget: monthlyIncome }
    // Include per-person contribution schedules if step filled
    data.people = people.map(p => {
      const reducesTo = contribReducesTo[p.name]
      const lastYears = contribLastYears[p.name]
      const yearsToRetirement = retirementAges[p.name] - p.currentAge
      if (reducesTo !== '' && reducesTo !== undefined && lastYears !== '' && lastYears !== undefined && Number(lastYears) < yearsToRetirement) {
        const flatMonthly = p.accounts.reduce((s, a) => s + (a.monthlyContribution || 0), 0)
        return {
          ...p,
          contributionSchedule: [
            { fromYearsFromToday: 0, monthlyAmount: flatMonthly },
            { fromYearsFromToday: yearsToRetirement - Number(lastYears), monthlyAmount: Number(reducesTo) },
          ],
        }
      }
      return p
    })
    if (incomeReducesTo !== '' && incomeAfterYear !== '' && Number(incomeReducesTo) < monthlyIncome) {
      data.incomeSchedule = [
        { fromYearsFromRetirement: 0, monthlyAmount: monthlyIncome },
        { fromYearsFromRetirement: Number(incomeAfterYear), monthlyAmount: Number(incomeReducesTo) },
      ]
    }
    if (loadedCapitalEvents) data.capitalEvents = loadedCapitalEvents
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
        // Restore monthly income target from file
        if (typeof data.monthlyIncomeTarget === 'number') {
          setMonthlyIncome(data.monthlyIncomeTarget)
        }
        // Back-fill contribution step state per person
        const newContribReducesTo = {}
        const newContribLastYears = {}
        const newContribStepOpen = {}
        data.people.forEach(p => {
          const sched = p.contributionSchedule
          if (Array.isArray(sched) && sched.length === 2) {
            const defaultRetAge = Math.min(p.currentAge + 10, 65)
            const yearsToRetirement = defaultRetAge - p.currentAge
            const stepEntry = sched[1]
            newContribReducesTo[p.name] = stepEntry.monthlyAmount
            const inferredLastYears = yearsToRetirement - stepEntry.fromYearsFromToday
            newContribLastYears[p.name] = inferredLastYears > 0 ? inferredLastYears : ''
            newContribStepOpen[p.name] = true
          }
        })
        setContribReducesTo(newContribReducesTo)
        setContribLastYears(newContribLastYears)
        setContribStepOpen(newContribStepOpen)
        // Back-fill income step state
        const incomeSched = data.incomeSchedule
        if (Array.isArray(incomeSched) && incomeSched.length === 2) {
          setIncomeReducesTo(incomeSched[1].monthlyAmount)
          setIncomeAfterYear(incomeSched[1].fromYearsFromRetirement)
          setIncomeStepOpen(true)
        } else {
          setIncomeReducesTo('')
          setIncomeAfterYear('')
          setIncomeStepOpen(false)
        }
        // Store capital events
        setLoadedCapitalEvents(data.capitalEvents ?? null)
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

  // Breakdown derived values
  const survivalDisplayRows = lastResult
    ? lastResult.survivalTable.filter(row => (row.age - lastResult.householdRetirementAge) % 5 === 0)
    : []
  const snap = lastResult?.accumulationSnapshot?.real ?? null
  const snapRange = snap ? snap.p90 - snap.p10 : 0
  const snapTrackPct = (val) => {
    if (!snap || snapRange <= 0) return '0%'
    return `${((val - snap.p10) / snapRange * 100).toFixed(1)}%`
  }

  // Debug table derived values
  const debugRefPerson = lastResult
    ? (people.find(p => p.name === lastResult.householdRetirementName) ?? people[0])
    : null
  const currentYear = new Date().getFullYear()
  const peopleWithSP = people.filter(p => p.statePension)

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

                {/* Contribution step-change disclosure */}
                <div className="pt-2 space-y-2">
                  {people.map(p => {
                    const yearsToRetirement = retirementAges[p.name] - p.currentAge
                    const isOpen = !!contribStepOpen[p.name]
                    const reducesTo = contribReducesTo[p.name] ?? ''
                    const lastYears = contribLastYears[p.name] ?? ''
                    const warnReducesTo = reducesTo !== '' && Number(reducesTo) >= p.accounts.reduce((s, a) => s + (a.monthlyContribution || 0), 0)
                    const warnLastYears = lastYears !== '' && Number(lastYears) >= yearsToRetirement
                    return (
                      <div key={p.name} className="text-xs">
                        <button
                          className="text-primary hover:underline underline-offset-2"
                          onClick={() => setContribStepOpen(prev => ({ ...prev, [p.name]: !isOpen }))}
                          disabled={isLoading}
                        >
                          {isOpen ? '▲' : '▼'} {hasPartner ? `${p.name}: ` : ''}Add contribution step-change
                        </button>
                        {isOpen && (
                          <div className="mt-2 space-y-2 pl-2 border-l">
                            <div className="space-y-1">
                              <label className="text-muted-foreground">Reduces to (£/mo)</label>
                              <Input
                                type="number"
                                min={0}
                                className="w-28 text-sm"
                                value={reducesTo}
                                onChange={e => {
                                  setContribReducesTo(prev => ({ ...prev, [p.name]: e.target.value }))
                                  scheduleRun(retirementAges, monthlyIncome)
                                }}
                                disabled={isLoading}
                              />
                              {warnReducesTo && (
                                <p className="text-destructive">Must be less than current contributions</p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <label className="text-muted-foreground">For the last N years before retirement</label>
                              <Input
                                type="number"
                                min={1}
                                className="w-20 text-sm"
                                value={lastYears}
                                onChange={e => {
                                  setContribLastYears(prev => ({ ...prev, [p.name]: e.target.value }))
                                  scheduleRun(retirementAges, monthlyIncome)
                                }}
                                disabled={isLoading}
                              />
                              {warnLastYears && (
                                <p className="text-destructive">Must be less than years to retirement ({yearsToRetirement})</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
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

                {/* Income step-change disclosure */}
                <div className="pt-1 text-xs text-center">
                  <button
                    className="text-primary hover:underline underline-offset-2"
                    onClick={() => setIncomeStepOpen(v => !v)}
                    disabled={isLoading}
                  >
                    {incomeStepOpen ? '▲' : '▼'} Add income step-change
                  </button>
                  {incomeStepOpen && (() => {
                    const warnReducesTo = incomeReducesTo !== '' && Number(incomeReducesTo) >= monthlyIncome
                    return (
                      <div className="mt-2 space-y-2 text-left border-l pl-2">
                        <div className="space-y-1">
                          <label className="text-muted-foreground">Reduces to (£/mo)</label>
                          <Input
                            type="number"
                            min={0}
                            className="w-28 text-sm"
                            value={incomeReducesTo}
                            onChange={e => {
                              setIncomeReducesTo(e.target.value)
                              scheduleRun(retirementAges, monthlyIncome)
                            }}
                            disabled={isLoading}
                          />
                          {warnReducesTo && (
                            <p className="text-destructive">Must be less than income target (£{monthlyIncome}/mo)</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground">After N years in retirement</label>
                          <Input
                            type="number"
                            min={1}
                            className="w-20 text-sm"
                            value={incomeAfterYear}
                            onChange={e => {
                              setIncomeAfterYear(e.target.value)
                              scheduleRun(retirementAges, monthlyIncome)
                            }}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    )
                  })()}
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
              {/* Toggle row */}
              <div className="flex items-center justify-between pt-1">
                <button
                  className="text-xs text-primary hover:underline underline-offset-2"
                  onClick={() => setShowBreakdown(v => !v)}
                >
                  {showBreakdown ? '\u25b2 Hide detailed breakdown' : '\u25bc Show detailed breakdown'}
                </button>
                <button
                  className="text-xs text-primary hover:underline underline-offset-2"
                  onClick={() => setShowDebug(v => !v)}
                >
                  {showDebug ? '\u25b2 Hide debug table' : 'Show debug table \u25bc'}
                </button>
              </div>
            </div>

            {/* Breakdown section */}
            {showBreakdown && lastResult && (
              <div className="border-t pt-4 space-y-6">

                {/* Section 1: Survival by age bar chart */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    How likely is your money to last?
                  </p>
                  <div className="flex gap-2 h-16 items-end">
                    {survivalDisplayRows.map(row => {
                      const barHeightPx = Math.max(Math.round(row.probabilitySolvent * 48), 2)
                      return (
                        <div key={row.age} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] leading-none text-muted-foreground">
                            {Math.round(row.probabilitySolvent * 100)}%
                          </span>
                          <div
                            className="w-full rounded-t-sm bg-primary"
                            style={{ height: `${barHeightPx}px` }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    {survivalDisplayRows.map(row => (
                      <div key={row.age} className="flex-1 text-center text-[10px] text-muted-foreground">
                        {row.age}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Percentile range at retirement */}
                {snap && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      What you might have when you retire
                    </p>
                    <p className="text-xs text-muted-foreground">in today&apos;s money</p>
                    <div className="relative h-2 bg-muted rounded-full">
                      <div
                        className="absolute h-full bg-primary/40 rounded-full"
                        style={{
                          left: snapTrackPct(snap.p25),
                          width: `${snapRange > 0 ? ((snap.p75 - snap.p25) / snapRange * 100).toFixed(1) : 0}%`,
                        }}
                      />
                      <div
                        className="absolute w-0.5 h-full bg-primary"
                        style={{ left: snapTrackPct(snap.p50) }}
                      />
                    </div>
                    <div className="relative h-10">
                      {[
                        { val: snap.p10, label: 'p10' },
                        { val: snap.p25, label: 'p25' },
                        { val: snap.p50, label: 'p50' },
                        { val: snap.p75, label: 'p75' },
                        { val: snap.p90, label: 'p90' },
                      ].map(({ val, label }) => (
                        <div
                          key={label}
                          className="absolute text-center"
                          style={{ left: snapTrackPct(val), transform: 'translateX(-50%)' }}
                        >
                          <p className="text-[10px] font-medium whitespace-nowrap">{fmtSnapK(val)}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 3: State pension */}
                {lastResult.statePensions?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      State pension
                    </p>
                    {lastResult.statePensions.map(sp => (
                      <p key={sp.name} className="text-sm">
                        <span className="font-medium">{sp.name}</span>{' '}
                        <span className="text-muted-foreground">
                          {formatCurrency(sp.annualAmount / 12)}/mo (£{sp.annualAmount.toLocaleString()}/yr) from age {sp.fromAge}
                        </span>
                      </p>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* Debug section */}
            {showDebug && lastResult && debugRefPerson && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Debug — POST /simulate response
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  numSimulations: {lastResult.numSimulations} &middot;{' '}
                  probabilityOfRuin: {lastResult.probabilityOfRuin} &middot;{' '}
                  householdRetirementAge: {lastResult.householdRetirementAge} ({lastResult.householdRetirementName}) &middot;{' '}
                  effectiveRate: {lastResult.withdrawalRate}
                </p>
                <div className="overflow-auto max-h-64 rounded border text-xs font-mono">
                  <table className="w-full border-collapse min-w-max">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-2 py-1 font-medium">Year</th>
                        {people.map(p => (
                          <th key={p.name} className="px-2 py-1 font-medium">{p.name}</th>
                        ))}
                        <th className="px-2 py-1 font-medium">Phase</th>
                        {peopleWithSP.map(p => (
                          <th key={p.name} className="px-2 py-1 font-medium">{p.name} SP</th>
                        ))}
                        <th className="px-2 py-1 font-medium">p10 (real)</th>
                        <th className="px-2 py-1 font-medium">p50 (real)</th>
                        <th className="px-2 py-1 font-medium">p90 (real)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastResult.portfolioPercentiles.byAge.map(entry => {
                        const isRetire = entry.age === lastResult.householdRetirementAge + 1
                        const phase = entry.age <= lastResult.householdRetirementAge ? 'A' : 'D'
                        const calYear = currentYear + (entry.age - debugRefPerson.currentAge)
                        return (
                          <tr
                            key={entry.age}
                            className={cn('border-b last:border-0', isRetire && 'bg-primary/5 font-semibold')}
                          >
                            <td className="px-2 py-0.5">{calYear}</td>
                            {people.map(p => (
                              <td key={p.name} className="px-2 py-0.5">
                                {p.currentAge + (entry.age - debugRefPerson.currentAge)}
                              </td>
                            ))}
                            <td className="px-2 py-0.5">{phase}{isRetire ? ' \u2190' : ''}</td>
                            {peopleWithSP.map(p => {
                              const personAge = p.currentAge + (entry.age - debugRefPerson.currentAge)
                              return (
                                <td key={p.name} className="px-2 py-0.5">
                                  {personAge >= p.statePension.fromAge
                                    ? `\u00a3${p.statePension.annualAmount.toLocaleString()}/yr`
                                    : '\u2014'}
                                </td>
                              )
                            })}
                            <td className="px-2 py-0.5">£{entry.real[9].toLocaleString()}</td>
                            <td className="px-2 py-0.5">£{entry.real[49].toLocaleString()}</td>
                            <td className="px-2 py-0.5">£{entry.real[89].toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
