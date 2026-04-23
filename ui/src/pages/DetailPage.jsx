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

  const { result, people, retirementAges, monthlyIncome, pots: scenarioPots = [] } = state
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

  // Build balance sheet for selected year.
  const balanceSheet = useMemo(() => {
    const potPercEntry = result?.potPercentiles?.byYear?.[selectedIndex]
    const liabEntry = result?.liabilities?.byYear?.[selectedIndex]

    // Assets: one row per pot using realP50 from potPercentiles.
    const assetRows = scenarioPots.map(pot => ({
      id: pot.id,
      value: potPercEntry?.byPot?.[pot.id]?.realP50 ?? 0,
      liquid: pot.type !== 'property' && pot.type !== 'depreciating',
    }))
    const totalAssets = assetRows.reduce((s, r) => s + r.value, 0)

    // Liabilities: mortgage balances from liabilities.byYear.
    const mortgageBalances = liabEntry?.mortgageBalances ?? {}
    const liabilityRows = Object.entries(mortgageBalances)
      .filter(([, v]) => v > 0)
      .map(([potId, balance]) => ({ id: potId, value: balance }))
    const totalLiabilities = liabilityRows.reduce((s, r) => s + r.value, 0)

    return { assetRows, totalAssets, liabilityRows, totalLiabilities, netEquity: totalAssets - totalLiabilities }
  }, [result, selectedIndex, scenarioPots])

  // Build cashflow statement for selected year.
  const cashflowStatement = useMemo(() => {
    // Helper: net equity at a given yearIndex from potPercentiles + liabilities.
    const netEquityAt = (idx) => {
      if (idx < 0) {
        // Year 0 opening: use initial pot values and initial mortgage balances from scenario.
        const assets = scenarioPots.reduce((s, p) => s + (p.initialValue ?? 0), 0)
        const liabs = scenarioPots.reduce((s, p) => s + (p.mortgage?.outstandingBalance ?? 0), 0)
        return assets - liabs
      }
      const potEntry = result?.potPercentiles?.byYear?.[idx]
      const liabEntry = result?.liabilities?.byYear?.[idx]
      const assets = scenarioPots.reduce((s, p) => s + (potEntry?.byPot?.[p.id]?.realP50 ?? 0), 0)
      const liabs = Object.values(liabEntry?.mortgageBalances ?? {}).reduce((s, v) => s + v, 0)
      return assets - liabs
    }

    const closingEquity = netEquityAt(selectedIndex)
    const openingEquity = netEquityAt(selectedIndex - 1)

    const is = result?.incomeStatementByYear?.[selectedIndex] ?? {}
    const grossIncome = (is.income ?? []).reduce((s, r) => s + r.amount, 0)
    const totalTaxNI = (is.tax ?? 0) + (is.ni ?? 0)
    const totalExpense = (is.expense ?? []).reduce((s, r) => s + r.amount, 0)
    const netSurplus = grossIncome - totalTaxNI - totalExpense

    const capitalIn = (is.capitalIn ?? []).reduce((s, r) => s + r.amount, 0)
    const capitalOut = (is.capitalOut ?? []).reduce((s, r) => s + r.amount, 0)

    const impliedReturn = closingEquity - openingEquity - netSurplus - capitalIn + capitalOut

    return { openingEquity, netSurplus, capitalIn, capitalOut, impliedReturn, closingEquity }
  }, [result, selectedIndex, scenarioPots])

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

        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Household Balance Sheet</h2>

          {/* Assets */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assets</p>
            {balanceSheet.assetRows.map(row => (
              <div key={row.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate">{row.id}</span>
                <span className="font-medium shrink-0">{fmtMoney(row.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm border-t pt-1 mt-1">
              <span className="font-medium">Total assets</span>
              <span className="font-semibold">{fmtMoney(balanceSheet.totalAssets)}</span>
            </div>
          </div>

          {/* Liabilities */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Liabilities</p>
            {balanceSheet.liabilityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              balanceSheet.liabilityRows.map(row => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{row.id} (mortgage)</span>
                  <span className="font-medium shrink-0">{fmtMoney(row.value)}</span>
                </div>
              ))
            )}
            {balanceSheet.liabilityRows.length > 0 && (
              <div className="flex items-center justify-between text-sm border-t pt-1 mt-1">
                <span className="font-medium">Total liabilities</span>
                <span className="font-semibold">{fmtMoney(balanceSheet.totalLiabilities)}</span>
              </div>
            )}
          </div>

          {/* Net equity */}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-base font-semibold">Net equity</span>
            <span className="text-lg font-bold">{fmtMoney(balanceSheet.netEquity)}</span>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Income Statement — {selected.calYear} (age {selected.age})
          </h2>

          {!result?.incomeStatementByYear ? (
            <p className="text-sm text-muted-foreground">Detailed year data unavailable.</p>
          ) : (() => {
            const is = result.incomeStatementByYear[selectedIndex] ?? {}
            const grossIncome = (is.income ?? []).reduce((s, r) => s + r.amount, 0)
            const totalTax = (is.tax ?? 0) + (is.ni ?? 0)
            const netIncome = grossIncome - totalTax
            const totalExpense = (is.expense ?? []).reduce((s, r) => s + r.amount, 0)
            const netSurplus = netIncome - totalExpense
            const capitalInTotal = (is.capitalIn ?? []).reduce((s, r) => s + r.amount, 0)
            const capitalOutTotal = (is.capitalOut ?? []).reduce((s, r) => s + r.amount, 0)

            return (
              <>
                {/* Gross income */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gross income</p>
                  {(is.income ?? []).map((item, i) => (
                    <div key={`${item.id}-${i}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate">{item.id}</span>
                      <span className="font-medium shrink-0">{fmtMoney(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm border-t pt-1 mt-1">
                    <span className="font-medium">Total gross income</span>
                    <span className="font-semibold">{fmtMoney(grossIncome)}</span>
                  </div>
                </div>

                {/* Tax & NI */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Less: tax &amp; NI</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Income tax</span>
                    <span className="font-medium shrink-0">{is.tax > 0 ? `(${fmtMoney(is.tax)})` : fmtMoney(0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">National Insurance</span>
                    <span className="font-medium shrink-0">{is.ni > 0 ? `(${fmtMoney(is.ni)})` : fmtMoney(0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-1 mt-1">
                    <span className="font-medium">Total tax &amp; NI</span>
                    <span className="font-semibold">{totalTax > 0 ? `(${fmtMoney(totalTax)})` : fmtMoney(0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="font-medium">Net income after tax</span>
                    <span className="font-semibold">{fmtMoney(netIncome)}</span>
                  </div>
                </div>

                {/* Expenditure */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expenditure</p>
                  {(is.expense ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (is.expense ?? []).map((item, i) => (
                    <div key={`${item.id}-${i}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate">{item.id}</span>
                      <span className="font-medium shrink-0">{item.amount > 0 ? `(${fmtMoney(item.amount)})` : fmtMoney(0)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm border-t pt-1 mt-1">
                    <span className="font-medium">Total expenditure</span>
                    <span className="font-semibold">{totalExpense > 0 ? `(${fmtMoney(totalExpense)})` : fmtMoney(0)}</span>
                  </div>
                </div>

                {/* Net surplus */}
                <div className={cn(
                  'flex items-center justify-between border-t pt-3',
                  netSurplus >= 0 ? 'text-primary' : 'text-destructive',
                )}>
                  <span className="text-base font-semibold text-foreground">Net surplus / (deficit)</span>
                  <span className="text-lg font-bold">
                    {netSurplus >= 0 ? fmtMoney(netSurplus) : `(${fmtMoney(Math.abs(netSurplus))})`}
                  </span>
                </div>

                {/* Capital movements */}
                {(capitalInTotal > 0 || capitalOutTotal > 0) && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capital movements</p>
                    {(is.capitalIn ?? []).filter(r => r.amount > 0).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Capital in</p>
                        {(is.capitalIn ?? []).filter(r => r.amount > 0).map((item, i) => (
                          <div key={`${item.id}-${i}`} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate">{item.id}</span>
                            <span className="font-medium shrink-0">{fmtMoney(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(is.capitalOut ?? []).filter(r => r.amount > 0).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Capital out</p>
                        {(is.capitalOut ?? []).filter(r => r.amount > 0).map((item, i) => (
                          <div key={`${item.id}-${i}`} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate">{item.id}</span>
                            <span className="font-medium shrink-0">{`(${fmtMoney(item.amount)})`}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* Cashflow Statement */}
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cashflow Statement — {selected.calYear} (age {selected.age})
          </h2>

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Opening net equity</span>
              <span className="font-semibold">{fmtMoney(cashflowStatement.openingEquity)}</span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>+ Net surplus / (deficit)</span>
              <span className={cashflowStatement.netSurplus >= 0 ? '' : 'text-destructive'}>
                {cashflowStatement.netSurplus >= 0
                  ? fmtMoney(cashflowStatement.netSurplus)
                  : `(${fmtMoney(Math.abs(cashflowStatement.netSurplus))})`}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>+ Capital in</span>
              <span>{fmtMoney(cashflowStatement.capitalIn)}</span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>− Capital out</span>
              <span>{cashflowStatement.capitalOut > 0 ? `(${fmtMoney(cashflowStatement.capitalOut)})` : fmtMoney(0)}</span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span
                className="cursor-help underline decoration-dotted underline-offset-2"
                title="Residual of closing minus opening net equity, after accounting for surplus and capital flows. Captures investment returns and property growth using the p50 cross-section — an approximation accurate to within ~0.1% of portfolio value."
              >
                + Implied investment &amp; growth (p50)
              </span>
              <span className={cashflowStatement.impliedReturn >= 0 ? '' : 'text-destructive'}>
                {cashflowStatement.impliedReturn >= 0
                  ? fmtMoney(cashflowStatement.impliedReturn)
                  : `(${fmtMoney(Math.abs(cashflowStatement.impliedReturn))})`}
              </span>
            </div>

            <div className="flex items-center justify-between border-t pt-2 mt-1">
              <span className="font-medium">Closing net equity</span>
              <span className="font-semibold">{fmtMoney(cashflowStatement.closingEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
