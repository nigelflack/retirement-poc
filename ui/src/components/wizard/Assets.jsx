import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ACCOUNT_TYPES = ['Pension', 'ISA']

function emptyAccount() {
  return { name: '', type: 'Pension', currentValue: '', monthlyContribution: '' }
}

function emptyContribStep() {
  return { fromYearsFromToday: '', monthlyAmount: '', label: '' }
}

function emptyIncomeStream() {
  return { fromYearsFromToday: '0', toYearsFromToday: '', monthlyAmount: '', label: '' }
}

function emptyCapitalEvent() {
  return { yearsFromToday: '', amount: '', label: '' }
}

function SectionHeading({ label }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-4 pb-1 border-b mb-3">
      {label}
    </div>
  )
}

function CollapsibleSection({ label, open, onToggle, children }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground w-full text-left pt-4 pb-1 border-b mb-3"
      >
        <span className="text-xs">{open ? '▲' : '▼'}</span>
        <span>{label}</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  )
}

export default function Assets({
  people,
  capitalEvents: initialCapitalEvents = [],
  scenarioLabel: initialScenarioLabel = '',
  onComplete,
  onBack,
}) {
  // ── Per-person state ─────────────────────────────────────────────
  const [accounts, setAccounts] = useState(
    Object.fromEntries(people.map(p => [
      p.name,
      p.accounts?.length > 0
        ? p.accounts.map(a => ({
            name: a.name ?? '',
            type: a.type === 'pension' ? 'Pension' : 'ISA',
            currentValue: a.currentValue?.toString() ?? '',
            monthlyContribution: a.monthlyContribution?.toString() ?? '',
          }))
        : [emptyAccount()],
    ])),
  )

  const [statePensions, setStatePensions] = useState(
    Object.fromEntries(people.map(p => [
      p.name,
      p.statePension
        ? { annualAmount: p.statePension.annualAmount?.toString() ?? '', fromAge: p.statePension.fromAge?.toString() ?? '' }
        : { annualAmount: '', fromAge: '' },
    ])),
  )

  const [contribSchedules, setContribSchedules] = useState(
    Object.fromEntries(people.map(p => [
      p.name,
      Array.isArray(p.contributionSchedule) && p.contributionSchedule.length > 0
        ? p.contributionSchedule.map(s => ({
            fromYearsFromToday: s.fromYearsFromToday?.toString() ?? '0',
            monthlyAmount: s.monthlyAmount?.toString() ?? '',
            label: s.label ?? '',
          }))
        : [],
    ])),
  )

  const [incomeStreams, setIncomeStreams] = useState(
    Object.fromEntries(people.map(p => [
      p.name,
      Array.isArray(p.incomeStreams) && p.incomeStreams.length > 0
        ? p.incomeStreams.map(s => ({
            fromYearsFromToday: s.fromYearsFromToday?.toString() ?? '0',
            toYearsFromToday: s.toYearsFromToday != null ? s.toYearsFromToday.toString() : '',
            monthlyAmount: s.monthlyAmount?.toString() ?? '',
            label: s.label ?? '',
          }))
        : [],
    ])),
  )

  // ── Household state ──────────────────────────────────────────────
  const [householdLabel, setHouseholdLabel] = useState(initialScenarioLabel)

  const [capitalEventsState, setCapitalEventsState] = useState(
    Array.isArray(initialCapitalEvents) && initialCapitalEvents.length > 0
      ? initialCapitalEvents.map(e => ({
          yearsFromToday: e.yearsFromToday?.toString() ?? '',
          amount: e.amount?.toString() ?? '',
          label: e.label ?? '',
        }))
      : [],
  )

  // ── UI state ─────────────────────────────────────────────────────
  const allTabs = [...people.map(p => p.name), 'Household']
  const [activeTab, setActiveTab] = useState(people[0].name)
  const [contribOpen, setContribOpen] = useState(
    Object.fromEntries(people.map(p => [p.name, (contribSchedules[p.name]?.length ?? 0) > 0])),
  )
  const [streamsOpen, setStreamsOpen] = useState(
    Object.fromEntries(people.map(p => [p.name, (incomeStreams[p.name]?.length ?? 0) > 0])),
  )
  const [capitalEventsOpen, setCapitalEventsOpen] = useState(capitalEventsState.length > 0)
  const [errors, setErrors] = useState({})

  // ── Account handlers ─────────────────────────────────────────────
  function updateAccount(name, idx, field, value) {
    setAccounts(prev => {
      const list = [...prev[name]]
      list[idx] = { ...list[idx], [field]: value }
      return { ...prev, [name]: list }
    })
  }
  function addAccount(name) {
    setAccounts(prev => ({ ...prev, [name]: [...prev[name], emptyAccount()] }))
  }
  function removeAccount(name, idx) {
    setAccounts(prev => ({ ...prev, [name]: prev[name].filter((_, i) => i !== idx) }))
  }

  // ── State pension handlers ───────────────────────────────────────
  function updateStatePension(name, field, value) {
    setStatePensions(prev => ({ ...prev, [name]: { ...prev[name], [field]: value } }))
  }

  // ── Contribution schedule handlers ───────────────────────────────
  function addContribStep(name) {
    setContribSchedules(prev => ({ ...prev, [name]: [...prev[name], emptyContribStep()] }))
    setContribOpen(prev => ({ ...prev, [name]: true }))
  }
  function removeContribStep(name, idx) {
    setContribSchedules(prev => ({ ...prev, [name]: prev[name].filter((_, i) => i !== idx) }))
  }
  function updateContribStep(name, idx, field, value) {
    setContribSchedules(prev => {
      const list = [...prev[name]]
      list[idx] = { ...list[idx], [field]: value }
      return { ...prev, [name]: list }
    })
  }

  // ── Income stream handlers ───────────────────────────────────────
  function addIncomeStream(name) {
    setIncomeStreams(prev => ({ ...prev, [name]: [...prev[name], emptyIncomeStream()] }))
    setStreamsOpen(prev => ({ ...prev, [name]: true }))
  }
  function removeIncomeStream(name, idx) {
    setIncomeStreams(prev => ({ ...prev, [name]: prev[name].filter((_, i) => i !== idx) }))
  }
  function updateIncomeStream(name, idx, field, value) {
    setIncomeStreams(prev => {
      const list = [...prev[name]]
      list[idx] = { ...list[idx], [field]: value }
      return { ...prev, [name]: list }
    })
  }

  // ── Capital event handlers ───────────────────────────────────────
  function addCapitalEvent() {
    setCapitalEventsState(prev => [...prev, emptyCapitalEvent()])
    setCapitalEventsOpen(true)
  }
  function removeCapitalEvent(idx) {
    setCapitalEventsState(prev => prev.filter((_, i) => i !== idx))
  }
  function updateCapitalEvent(idx, field, value) {
    setCapitalEventsState(prev => {
      const list = [...prev]
      list[idx] = { ...list[idx], [field]: value }
      return list
    })
  }

  // ── Validation & submit ──────────────────────────────────────────
  function hasAtLeastOneValidAccount() {
    return people.some(p =>
      accounts[p.name].some(a => {
        const val = parseFloat(a.currentValue)
        return a.name.trim() && !isNaN(val) && val > 0
      }),
    )
  }

  function buildPayload() {
    const updatedPeople = people.map(p => {
      const sp = statePensions[p.name]

      const contribSched = contribSchedules[p.name]
        .filter(s => s.fromYearsFromToday !== '' && s.monthlyAmount !== '')
        .map(s => {
          const entry = {
            fromYearsFromToday: parseInt(s.fromYearsFromToday, 10),
            monthlyAmount: parseFloat(s.monthlyAmount),
          }
          if (s.label.trim()) entry.label = s.label.trim()
          return entry
        })

      const incStreams = incomeStreams[p.name]
        .filter(s => s.fromYearsFromToday !== '' && s.monthlyAmount !== '')
        .map(s => {
          const entry = {
            fromYearsFromToday: parseInt(s.fromYearsFromToday, 10),
            monthlyAmount: parseFloat(s.monthlyAmount),
          }
          if (s.toYearsFromToday !== '') entry.toYearsFromToday = parseInt(s.toYearsFromToday, 10)
          if (s.label.trim()) entry.label = s.label.trim()
          return entry
        })

      const person = {
        ...p,
        accounts: accounts[p.name]
          .filter(a => a.name.trim())
          .map(a => ({
            name: a.name.trim(),
            type: a.type.toLowerCase(),
            currentValue: parseFloat(a.currentValue) || 0,
            monthlyContribution: parseFloat(a.monthlyContribution) || 0,
          })),
        statePension: {
          annualAmount: parseFloat(sp.annualAmount) || 0,
          fromAge: parseInt(sp.fromAge, 10) || 67,
        },
      }
      if (contribSched.length > 0) {
        person.contributionSchedule = contribSched
      } else {
        delete person.contributionSchedule
      }
      if (incStreams.length > 0) {
        person.incomeStreams = incStreams
      } else {
        delete person.incomeStreams
      }
      return person
    })

    const capEvents = capitalEventsState
      .filter(e => e.yearsFromToday !== '' && e.amount !== '' && parseFloat(e.amount) !== 0)
      .map(e => {
        const entry = {
          yearsFromToday: parseInt(e.yearsFromToday, 10),
          amount: parseFloat(e.amount),
        }
        if (e.label.trim()) entry.label = e.label.trim()
        return entry
      })

    return {
      people: updatedPeople,
      capitalEvents: capEvents,
      label: householdLabel.trim(),
    }
  }

  function handleContinue() {
    if (!hasAtLeastOneValidAccount()) {
      setErrors({ general: 'Please add at least one account with a value.' })
      return
    }
    setErrors({})
    onComplete(buildPayload())
  }

  // ── Render ───────────────────────────────────────────────────────
  const isPersonTab = activeTab !== 'Household'
  const personName = isPersonTab ? activeTab : null

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your details</h1>

        {/* Tab bar */}
        <div className="flex space-x-1 border-b">
          {allTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Person tab ── */}
        {isPersonTab && (
          <>
            <SectionHeading label="Accounts" />
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <span className="col-span-4">Account name</span>
                <span className="col-span-2">Type</span>
                <span className="col-span-3">Current value (£)</span>
                <span className="col-span-2">Monthly (£)</span>
                <span className="col-span-1"></span>
              </div>
              {accounts[personName].map((acct, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-4"
                    placeholder="e.g. Workplace pension"
                    value={acct.name}
                    onChange={e => updateAccount(personName, idx, 'name', e.target.value)}
                  />
                  <select
                    className="col-span-2 h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={acct.type}
                    onChange={e => updateAccount(personName, idx, 'type', e.target.value)}
                  >
                    {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <Input
                    className="col-span-3"
                    type="number" min={0} placeholder="250000"
                    value={acct.currentValue}
                    onChange={e => updateAccount(personName, idx, 'currentValue', e.target.value)}
                  />
                  <Input
                    className="col-span-2"
                    type="number" min={0} placeholder="500"
                    value={acct.monthlyContribution}
                    onChange={e => updateAccount(personName, idx, 'monthlyContribution', e.target.value)}
                  />
                  <div className="col-span-1 flex justify-center">
                    {accounts[personName].length > 1 && (
                      <button
                        onClick={() => removeAccount(personName, idx)}
                        className="text-muted-foreground hover:text-destructive text-lg leading-none"
                        aria-label="Remove account"
                      >✕</button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => addAccount(personName)}>
                + Add account
              </Button>
            </div>

            <SectionHeading label="State pension" />
            <div className="flex items-end gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Annual amount (£)</Label>
                <Input
                  type="number" min={0} placeholder="11500" className="w-32"
                  value={statePensions[personName].annualAmount}
                  onChange={e => updateStatePension(personName, 'annualAmount', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From age</Label>
                <Input
                  type="number" min={55} max={80} placeholder="67" className="w-20"
                  value={statePensions[personName].fromAge}
                  onChange={e => updateStatePension(personName, 'fromAge', e.target.value)}
                />
              </div>
            </div>

            <CollapsibleSection
              label="Contributions"
              open={contribOpen[personName]}
              onToggle={() => setContribOpen(prev => ({ ...prev, [personName]: !prev[personName] }))}
            >
              {contribSchedules[personName].length > 0 && (
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span className="col-span-3">From (yrs)</span>
                  <span className="col-span-3">Monthly (£)</span>
                  <span className="col-span-5">Label (optional)</span>
                  <span className="col-span-1"></span>
                </div>
              )}
              {contribSchedules[personName].map((s, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-3" type="number" min={0} placeholder="0"
                    value={s.fromYearsFromToday}
                    onChange={e => updateContribStep(personName, idx, 'fromYearsFromToday', e.target.value)}
                  />
                  <Input
                    className="col-span-3" type="number" min={0} placeholder="2000"
                    value={s.monthlyAmount}
                    onChange={e => updateContribStep(personName, idx, 'monthlyAmount', e.target.value)}
                  />
                  <Input
                    className="col-span-5" placeholder="e.g. Current rate"
                    value={s.label}
                    onChange={e => updateContribStep(personName, idx, 'label', e.target.value)}
                  />
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeContribStep(personName, idx)}
                      className="text-muted-foreground hover:text-destructive text-lg leading-none"
                      aria-label="Remove step"
                    >✕</button>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => addContribStep(personName)}>
                + Add step
              </Button>
              <p className="text-xs text-muted-foreground">
                When empty, the server uses per-account monthly contribution amounts.
              </p>
            </CollapsibleSection>

            <CollapsibleSection
              label="Income streams"
              open={streamsOpen[personName]}
              onToggle={() => setStreamsOpen(prev => ({ ...prev, [personName]: !prev[personName] }))}
            >
              {incomeStreams[personName].length > 0 && (
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span className="col-span-2">From (yrs)</span>
                  <span className="col-span-2">To (opt)</span>
                  <span className="col-span-2">Monthly (£)</span>
                  <span className="col-span-5">Label (optional)</span>
                  <span className="col-span-1"></span>
                </div>
              )}
              {incomeStreams[personName].map((s, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-2" type="number" min={0} placeholder="0"
                    value={s.fromYearsFromToday}
                    onChange={e => updateIncomeStream(personName, idx, 'fromYearsFromToday', e.target.value)}
                  />
                  <Input
                    className="col-span-2" type="number" min={0} placeholder="—"
                    value={s.toYearsFromToday}
                    onChange={e => updateIncomeStream(personName, idx, 'toYearsFromToday', e.target.value)}
                  />
                  <Input
                    className="col-span-2" type="number" min={0} placeholder="800"
                    value={s.monthlyAmount}
                    onChange={e => updateIncomeStream(personName, idx, 'monthlyAmount', e.target.value)}
                  />
                  <Input
                    className="col-span-5" placeholder="e.g. BTL rental"
                    value={s.label}
                    onChange={e => updateIncomeStream(personName, idx, 'label', e.target.value)}
                  />
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeIncomeStream(personName, idx)}
                      className="text-muted-foreground hover:text-destructive text-lg leading-none"
                      aria-label="Remove stream"
                    >✕</button>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => addIncomeStream(personName)}>
                + Add income stream
              </Button>
            </CollapsibleSection>
          </>
        )}

        {/* ── Household tab ── */}
        {!isPersonTab && (
          <>
            <SectionHeading label="Scenario label" />
            <Input
              placeholder="e.g. Base case"
              value={householdLabel}
              onChange={e => setHouseholdLabel(e.target.value)}
            />

            <CollapsibleSection
              label="Capital events"
              open={capitalEventsOpen}
              onToggle={() => setCapitalEventsOpen(o => !o)}
            >
              {capitalEventsState.length > 0 && (
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span className="col-span-3">Years from today</span>
                  <span className="col-span-3">Amount (£, +/−)</span>
                  <span className="col-span-5">Label (optional)</span>
                  <span className="col-span-1"></span>
                </div>
              )}
              {capitalEventsState.map((ev, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-3" type="number" min={0} placeholder="5"
                    value={ev.yearsFromToday}
                    onChange={e => updateCapitalEvent(idx, 'yearsFromToday', e.target.value)}
                  />
                  <Input
                    className="col-span-3" type="number" placeholder="-50000"
                    value={ev.amount}
                    onChange={e => updateCapitalEvent(idx, 'amount', e.target.value)}
                  />
                  <Input
                    className="col-span-5" placeholder="e.g. Inheritance"
                    value={ev.label}
                    onChange={e => updateCapitalEvent(idx, 'label', e.target.value)}
                  />
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeCapitalEvent(idx)}
                      className="text-muted-foreground hover:text-destructive text-lg leading-none"
                      aria-label="Remove event"
                    >✕</button>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-primary" onClick={addCapitalEvent}>
                + Add event
              </Button>
            </CollapsibleSection>
          </>
        )}

        {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}

        <div className="flex items-center justify-between pt-4">
          <Button onClick={handleContinue}>Continue</Button>
          <Button variant="outline" onClick={onBack}>← Back</Button>
        </div>
      </div>
    </div>
  )
}
