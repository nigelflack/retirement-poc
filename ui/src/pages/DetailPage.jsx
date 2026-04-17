import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ComposedChart, AreaChart, Area, Bar, BarChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

// --- Helpers ---

function fmtK(n) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`
  if (Math.abs(n) >= 1_000) return `£${Math.round(n / 1_000)}k`
  return `£${Math.round(n)}`
}

function fmtMoney(n) {
  if (n == null || n === 0) return '—'
  return `£${Math.round(n).toLocaleString()}`
}

function fmtMoneySign(n) {
  if (!n || n === 0) return '—'
  const prefix = n > 0 ? '+' : ''
  return `${prefix}£${Math.round(n).toLocaleString()}`
}

const TABS = ['Year by year', 'Fan chart', 'Spending sources']

// --- Tab 1: Year-by-year table ---

function YearByYearTab({ result, people, capitalEvents }) {
  const refPerson = people.find(p => p.name === result.householdRetirementName) ?? people[0]
  const rs = result.resolvedSchedules
  const currentYear = new Date().getFullYear()
  const hasCapEvents = capitalEvents && capitalEvents.length > 0
  const peopleWithSP = people.filter(p => p.statePension)

  return (
    <div className="overflow-auto rounded border text-xs font-mono">
      <table className="w-full border-collapse min-w-max">
        <thead className="sticky top-0 bg-background border-b z-10">
          <tr className="text-left text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Cal. year</th>
            {people.map(p => (
              <th key={p.name} className="px-2 py-1.5 font-medium">{p.name}</th>
            ))}
            <th className="px-2 py-1.5 font-medium">Phase</th>
            <th className="px-2 py-1.5 font-medium text-right">Contrib (£/yr)</th>
            <th className="px-2 py-1.5 font-medium text-right">Inc. streams (£/yr)</th>
            <th className="px-2 py-1.5 font-medium text-right">Spend target (£/yr)</th>
            {hasCapEvents && <th className="px-2 py-1.5 font-medium text-right">Cap. event</th>}
            {peopleWithSP.map(p => (
              <th key={p.name} className="px-2 py-1.5 font-medium text-right">{p.name} SP</th>
            ))}
            <th className="px-2 py-1.5 font-medium text-right">p10 (real)</th>
            <th className="px-2 py-1.5 font-medium text-right">p50 (real)</th>
            <th className="px-2 py-1.5 font-medium text-right">p90 (real)</th>
          </tr>
        </thead>
        <tbody>
          {result.portfolioPercentiles.byAge.map((entry, rowIdx) => {
            const yearOffset = entry.age - refPerson.currentAge        // 1-based age offset
            const y = yearOffset - 1                                   // 0-based year index
            const isRetire = entry.age === result.householdRetirementAge + 1
            const phase = entry.age <= result.householdRetirementAge ? 'A' : 'D'
            const calYear = currentYear + yearOffset

            const totalContrib = rs
              ? rs.contributionByYear.reduce((s, personArr) => s + (personArr[y] ?? 0), 0)
              : 0
            const incomeStreams = rs ? (rs.otherIncomeByYear[y] ?? 0) : 0
            const spendTarget = rs ? (rs.spendingTargetByYear[y] ?? 0) : 0
            const capEventSum = rs ? (rs.capitalEventsByYear[y] ?? 0) : 0

            return (
              <tr
                key={entry.age}
                className={cn(
                  'border-b last:border-0',
                  isRetire && 'bg-primary/5 font-semibold',
                  rowIdx % 2 === 0 && !isRetire && 'bg-muted/20',
                )}
              >
                <td className="px-2 py-0.5">{calYear}</td>
                {people.map(p => (
                  <td key={p.name} className="px-2 py-0.5">
                    {p.currentAge + yearOffset}
                  </td>
                ))}
                <td className="px-2 py-0.5">{phase}{isRetire ? ' ←' : ''}</td>
                <td className="px-2 py-0.5 text-right">
                  {totalContrib > 0 ? `£${Math.round(totalContrib).toLocaleString()}` : '—'}
                </td>
                <td className="px-2 py-0.5 text-right">
                  {incomeStreams > 0 ? `£${Math.round(incomeStreams).toLocaleString()}` : '—'}
                </td>
                <td className="px-2 py-0.5 text-right">
                  {spendTarget > 0 ? `£${Math.round(spendTarget).toLocaleString()}` : '—'}
                </td>
                {hasCapEvents && (
                  <td className={cn(
                    'px-2 py-0.5 text-right font-semibold',
                    capEventSum > 0 && 'text-green-700 dark:text-green-400',
                    capEventSum < 0 && 'text-destructive',
                  )}>
                    {fmtMoneySign(capEventSum)}
                  </td>
                )}
                {peopleWithSP.map(p => {
                  const personAge = p.currentAge + yearOffset
                  return (
                    <td key={p.name} className="px-2 py-0.5 text-right">
                      {personAge >= p.statePension.fromAge
                        ? `£${p.statePension.annualAmount.toLocaleString()}/yr`
                        : '—'}
                    </td>
                  )
                })}
                <td className="px-2 py-0.5 text-right">£{entry.real[9].toLocaleString()}</td>
                <td className="px-2 py-0.5 text-right">£{entry.real[49].toLocaleString()}</td>
                <td className="px-2 py-0.5 text-right">£{entry.real[89].toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Tab 2: Fan chart ---

function FanChartTab({ result, people }) {
  const refPerson = people.find(p => p.name === result.householdRetirementName) ?? people[0]

  const chartData = result.portfolioPercentiles.byAge.map(entry => ({
    age: entry.age,
    p10: entry.real[9],
    p90: entry.real[98],
    p25: entry.real[24],
    p75: entry.real[74],
    p50: entry.real[49],
    // For range bands: [low, high] pairs
    outerBand: [entry.real[9], entry.real[98]],
    innerBand: [entry.real[24], entry.real[74]],
  }))

  const retireAge = result.householdRetirementAge

  // Custom tooltip
  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null
    const d = chartData.find(r => r.age === label)
    if (!d) return null
    return (
      <div className="rounded border bg-background p-2 text-xs shadow space-y-0.5">
        <p className="font-semibold">Age {label}</p>
        <p className="text-muted-foreground">p10: {fmtK(d.p10)}</p>
        <p className="text-muted-foreground">p25: {fmtK(d.p25)}</p>
        <p className="font-medium">p50: {fmtK(d.p50)}</p>
        <p className="text-muted-foreground">p75: {fmtK(d.p75)}</p>
        <p className="text-muted-foreground">p90: {fmtK(d.p90)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Portfolio value in today&apos;s money (real). Shaded bands show p10–p90 and p25–p75. Line is median (p50).</p>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 10 }}
            tickFormatter={v => v}
            label={{ value: 'Age', position: 'insideBottomRight', offset: -4, fontSize: 10 }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={fmtK}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={retireAge}
            stroke="hsl(var(--primary))"
            strokeDasharray="4 2"
            label={{ value: 'Retire', position: 'top', fontSize: 10 }}
          />
          {/* p10–p90 outer band: draw p90 fill down to p10 */}
          <Area
            type="monotone"
            dataKey="p90"
            stroke="none"
            fill="hsl(var(--primary))"
            fillOpacity={0.10}
            legendType="none"
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="p10"
            stroke="none"
            fill="hsl(var(--background))"
            fillOpacity={1}
            legendType="none"
            activeDot={false}
          />
          {/* p25–p75 inner band */}
          <Area
            type="monotone"
            dataKey="p75"
            stroke="none"
            fill="hsl(var(--primary))"
            fillOpacity={0.20}
            legendType="none"
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="p25"
            stroke="none"
            fill="hsl(var(--background))"
            fillOpacity={1}
            legendType="none"
            activeDot={false}
          />
          {/* p50 median line */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            name="Median (p50)"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-2 rounded" style={{ background: 'hsl(var(--primary))', opacity: 0.1 }} />
          p10–p90
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-2 rounded" style={{ background: 'hsl(var(--primary))', opacity: 0.3 }} />
          p25–p75
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-1 rounded" style={{ background: 'hsl(var(--primary))' }} />
          Median
        </span>
      </div>
    </div>
  )
}

// --- Tab 3: Spending sources ---

function SpendingSourcesTab({ result, people, capitalEvents }) {
  const rs = result.resolvedSchedules
  if (!rs) return <p className="text-sm text-muted-foreground">No resolved schedules available.</p>

  const retireYear = result.householdRetirementAge - (people.find(p => p.name === result.householdRetirementName) ?? people[0]).currentAge
  const totalYears = rs.spendingTargetByYear.length

  // Build per-drawdown-year data
  const chartData = []
  for (let y = retireYear; y < totalYears; y++) {
    const age = result.householdRetirementAge + (y - retireYear)
    const spendTarget = rs.spendingTargetByYear[y] / 12       // monthly

    // State pension: sum active ones for this year
    const refPerson = people.find(p => p.name === result.householdRetirementName) ?? people[0]
    let statePensionMonthly = 0
    for (const p of people) {
      if (!p.statePension) continue
      const personAge = p.currentAge + y
      if (personAge >= p.statePension.fromAge) {
        statePensionMonthly += p.statePension.annualAmount / 12
      }
    }

    const incomeStreamsMonthly = (rs.otherIncomeByYear[y] ?? 0) / 12
    const portfolioDraw = Math.max(0, spendTarget - statePensionMonthly - incomeStreamsMonthly)
    const capEvent = rs.capitalEventsByYear[y] ?? 0

    chartData.push({
      age,
      portfolioDraw: Math.round(portfolioDraw),
      statePension: Math.round(statePensionMonthly),
      incomeStreams: Math.round(incomeStreamsMonthly),
      spendTarget: Math.round(spendTarget),
      capEvent: capEvent !== 0 ? capEvent : null,
    })
  }

  // Capital event reference lines (one per unique year with a non-zero event)
  const capEventLines = capitalEvents
    ? capitalEvents
        .filter(e => {
          const y = e.yearsFromToday
          return y >= retireYear && y < totalYears
        })
        .map(e => ({
          age: result.householdRetirementAge + (e.yearsFromToday - retireYear),
          label: e.label ? `${e.label} (${e.amount > 0 ? '+' : ''}£${Math.abs(e.amount).toLocaleString()})` : (e.amount > 0 ? '+' : '') + `£${Math.abs(e.amount).toLocaleString()}`,
        }))
    : []

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null
    const d = chartData.find(r => r.age === label)
    if (!d) return null
    return (
      <div className="rounded border bg-background p-2 text-xs shadow space-y-0.5">
        <p className="font-semibold">Age {label}</p>
        <p>Portfolio draw: {fmtMoney(d.portfolioDraw)}/mo</p>
        {d.statePension > 0 && <p>State pension: {fmtMoney(d.statePension)}/mo</p>}
        {d.incomeStreams > 0 && <p>Income streams: {fmtMoney(d.incomeStreams)}/mo</p>}
        <p className="font-medium border-t pt-0.5 mt-0.5">Target: {fmtMoney(d.spendTarget)}/mo</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Monthly spending in today&apos;s money — how each year&apos;s target is met. Dashed line shows the spending target.</p>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 10 }}
            label={{ value: 'Age', position: 'insideBottomRight', offset: -4, fontSize: 10 }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={v => `£${(v / 1000).toFixed(0)}k`}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {capEventLines.map(ev => (
            <ReferenceLine
              key={ev.age}
              x={ev.age}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              label={{ value: ev.label, position: 'top', fontSize: 9, angle: -45, offset: 6 }}
            />
          ))}
          {/* Spending target line */}
          <Line
            type="stepAfter"
            dataKey="spendTarget"
            stroke="hsl(var(--foreground))"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            name="Spending target"
          />
          <Bar dataKey="incomeStreams" stackId="a" fill="hsl(142 71% 45%)" name="Income streams" />
          <Bar dataKey="statePension" stackId="a" fill="hsl(217 91% 60%)" name="State pension" />
          <Bar dataKey="portfolioDraw" stackId="a" fill="hsl(var(--primary))" name="Portfolio draw" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// --- Main page ---

export default function DetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)

  const state = location.state
  if (!state?.result || !state?.people) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">No scenario loaded.</p>
          <button
            className="text-sm text-primary hover:underline underline-offset-2"
            onClick={() => navigate('/')}
          >
            ← Go back and run a scenario first
          </button>
        </div>
      </div>
    )
  }

  const { result, people, capitalEvents, retirementAges, monthlyIncome } = state
  const primary = people[0]
  const partner = people[1] ?? null

  const headerName = partner
    ? `${primary.name} (${primary.currentAge}) and ${partner.name} (${partner.currentAge})`
    : `${primary.name} (${primary.currentAge})`

  const retirementAgesStr = people
    .map(p => `${p.name} retires ${retirementAges?.[p.name] ?? p.retirementAge}`)
    .join(', ')

  const solvencyPct = result
    ? Math.round((1 - result.probabilityOfRuin) * 100)
    : null

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">

        {/* Back link */}
        <button
          className="text-sm text-primary hover:underline underline-offset-2"
          onClick={() => navigate(-1)}
        >
          ← Back to scenario
        </button>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{headerName}</h1>
          <p className="text-sm text-muted-foreground">
            {retirementAgesStr} · £{monthlyIncome?.toLocaleString()}/mo spending
            {solvencyPct != null && ` · ${solvencyPct}% likely solvent at 90`}
          </p>
        </div>

        {/* Tab bar */}
        <div className="border-b">
          <div className="flex gap-0">
            {TABS.map((tab, idx) => (
              <button
                key={tab}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  idx === activeTab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setActiveTab(idx)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 0 && (
            <YearByYearTab result={result} people={people} capitalEvents={capitalEvents} />
          )}
          {activeTab === 1 && (
            <FanChartTab result={result} people={people} />
          )}
          {activeTab === 2 && (
            <SpendingSourcesTab result={result} people={people} capitalEvents={capitalEvents} />
          )}
        </div>

      </div>
    </div>
  )
}
