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
function ScenarioCard({ card, people }) {
  return (
    <div className={cn(
      'flex-1 rounded-lg border p-4 space-y-2',
      card.highlighted ? 'border-primary bg-primary/5' : 'bg-card',
    )}>
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

  // Previous values to revert to on error
  const prevRetirementAges = useRef(defaultRetirementAges)
  const prevMonthlyIncome = useRef(3000)
  const debounceTimer = useRef(null)
  const p2RunIdRef = useRef(0)

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
                  <ScenarioCard key={i} card={card} people={people} />
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
