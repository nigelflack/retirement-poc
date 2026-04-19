import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'

function fmtMoney(value) {
  const num = Number(value || 0)
  return `£${Math.round(num).toLocaleString()}`
}

function fmtSignedMoney(value) {
  const num = Number(value || 0)
  const sign = num > 0 ? '+' : ''
  return `${sign}${fmtMoney(num)}`
}

function fmtAxis(value) {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`
  if (Math.abs(n) >= 1_000) return `£${Math.round(n / 1_000)}k`
  return `£${Math.round(n)}`
}

function sumAmounts(items) {
  return (items ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

function DetailList({ title, items }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, idx) => (
            <li key={`${item.id || 'item'}-${idx}`} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground truncate">{item.id || 'unnamed'}</span>
              <span className="font-medium shrink-0">{fmtMoney(item.amount ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function buildYearRows(result, people) {
  const refPerson = people.find(p => p.name === result.householdRetirementName) ?? people[0]
  const byAge = result?.portfolioPercentiles?.byAge ?? []
  const resolvedYears = Array.isArray(result?.resolvedYears) ? result.resolvedYears : []
  const startYear = new Date().getFullYear()

  return byAge.map(entry => {
    const yearOffset = entry.age - refPerson.currentAge
    const yearIndex = yearOffset - 1
    const yearData = resolvedYears[yearIndex] ?? {
      income: [],
      expense: [],
      capitalIn: [],
      capitalOut: [],
    }

    const incomeItems = yearData.income ?? []
    const expenseItems = yearData.expense ?? []
    const capitalInItems = yearData.capitalIn ?? []
    const capitalOutItems = yearData.capitalOut ?? []

    const incomeTotal = sumAmounts(incomeItems)
    const expenseTotal = sumAmounts(expenseItems)
    const capitalInTotal = sumAmounts(capitalInItems)
    const capitalOutTotal = sumAmounts(capitalOutItems)
    const netCashflow = incomeTotal - expenseTotal + capitalInTotal - capitalOutTotal

    return {
      age: entry.age,
      yearOffset,
      calYear: startYear + yearOffset,
      yearIndex,
      incomeItems,
      expenseItems,
      capitalInItems,
      capitalOutItems,
      incomeTotal,
      expenseTotal,
      capitalInTotal,
      capitalOutTotal,
      netCashflow,
      p10: entry.real?.[9] ?? 0,
      p50: entry.real?.[49] ?? 0,
      p90: entry.real?.[89] ?? 0,
    }
  })
}

export default function DetailPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state
  if (!state?.result || !state?.people) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">No scenario loaded.</p>
          <button
            className="text-sm text-primary hover:underline underline-offset-2"
            onClick={() => navigate('/scenarios')}
          >
            ← Go to scenario loader
          </button>
        </div>
      </div>
    )
  }

  const { result, people, retirementAges, monthlyIncome } = state
  const primary = people[0]
  const partner = people[1] ?? null

  const headerName = partner
    ? `${primary.name} (${primary.currentAge}) and ${partner.name} (${partner.currentAge})`
    : `${primary.name} (${primary.currentAge})`

  const retirementAgesStr = people
    .map(p => `${p.name} retires ${retirementAges?.[p.name] ?? p.retirementAge}`)
    .join(', ')

  const rows = useMemo(() => buildYearRows(result, people), [result, people])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [rows.length])

  if (rows.length === 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="w-full max-w-4xl mx-auto space-y-4">
          <button
            className="text-sm text-primary hover:underline underline-offset-2"
            onClick={() => navigate(-1)}
          >
            ← Back to scenario
          </button>
          <p className="text-sm text-muted-foreground">Detailed year data is unavailable for this result.</p>
        </div>
      </div>
    )
  }

  const selected = rows[Math.max(0, Math.min(selectedIndex, rows.length - 1))]
  const chartData = rows.map(row => ({
    age: row.age,
    p10: row.p10,
    p50: row.p50,
    p90: row.p90,
  }))

  // Extract net-worth split for selected year
  const selectedNetWorth = useMemo(() => {
    if (!result?.netWorthPercentiles?.byAge) return null
    const entry = result.netWorthPercentiles.byAge[selectedIndex]
    if (!entry) return null
    return {
      liquidP50: entry.liquid?.real?.[49] ?? 0,
      nonLiquidP50: entry.nonLiquid?.real?.[49] ?? 0,
      totalP50: entry.total?.real?.[49] ?? 0,
    }
  }, [result, selectedIndex])

  function PercentileTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null
    const row = rows.find(r => r.age === label)
    if (!row) return null
    return (
      <div className="rounded border bg-background p-2 text-xs shadow space-y-0.5">
        <p className="font-semibold">{row.calYear} (age {row.age})</p>
        <p className="text-muted-foreground">p10: {fmtMoney(row.p10)}</p>
        <p className="font-medium">p50: {fmtMoney(row.p50)}</p>
        <p className="text-muted-foreground">p90: {fmtMoney(row.p90)}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <button
          className="text-sm text-primary hover:underline underline-offset-2"
          onClick={() => navigate(-1)}
        >
          ← Back to scenario
        </button>

        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{headerName}</h1>
          <p className="text-sm text-muted-foreground">
            {retirementAgesStr} · £{monthlyIncome?.toLocaleString()}/mo spending
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year rail</p>
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-2 pb-1">
              {rows.map((row, idx) => (
                <button
                  key={`${row.calYear}-${row.age}`}
                  className={cn(
                    'px-2.5 py-1 rounded-md border text-xs transition-colors',
                    idx === selectedIndex
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/60',
                  )}
                  onClick={() => setSelectedIndex(idx)}
                >
                  {row.calYear}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Percentile strip (real)</p>
          <ResponsiveContainer width="100%" height={120}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 10, bottom: 8, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="age" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtAxis} width={54} />
              <Tooltip content={<PercentileTooltip />} />
              <Area type="monotone" dataKey="p90" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.12} />
              <Area type="monotone" dataKey="p10" stroke="none" fill="hsl(var(--background))" fillOpacity={1} />
              <Line type="monotone" dataKey="p50" stroke="hsl(var(--primary))" strokeWidth={1.8} dot={false} />
              <ReferenceLine x={selected.age} stroke="hsl(var(--foreground))" strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net-worth split (p50, real)</p>
          {selectedNetWorth ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Liquid assets</p>
                <p className="font-semibold">{fmtMoney(selectedNetWorth.liquidP50)}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Non-liquid (property)</p>
                <p className="font-semibold">{fmtMoney(selectedNetWorth.nonLiquidP50)}</p>
              </div>
              <div className="rounded border p-3 bg-muted/50">
                <p className="text-xs text-muted-foreground">Total net-worth</p>
                <p className="font-semibold">{fmtMoney(selectedNetWorth.totalP50)}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Year {selected.calYear} (age {selected.age})
            </h2>
            <div className="text-sm text-muted-foreground">
              Net cashflow: <span className="font-semibold text-foreground">{fmtSignedMoney(selected.netCashflow)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailList title="Income" items={selected.incomeItems} />
            <DetailList title="Expenses" items={selected.expenseItems} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailList title="Capital In" items={selected.capitalInItems} />
            <DetailList title="Capital Out" items={selected.capitalOutItems} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Income total</p>
              <p className="font-semibold">{fmtMoney(selected.incomeTotal)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Expense total</p>
              <p className="font-semibold">{fmtMoney(selected.expenseTotal)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Capital net</p>
              <p className="font-semibold">{fmtSignedMoney(selected.capitalInTotal - selected.capitalOutTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">p10 (real)</p>
              <p className="font-semibold">{fmtMoney(selected.p10)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">p50 (real)</p>
              <p className="font-semibold">{fmtMoney(selected.p50)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">p90 (real)</p>
              <p className="font-semibold">{fmtMoney(selected.p90)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
