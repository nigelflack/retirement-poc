import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const ACCOUNT_TYPES = ['Pension', 'ISA']

function emptyAccount() {
  return { name: '', type: 'Pension', currentValue: '', monthlyContribution: '' }
}

function emptyStatePension() {
  return { annualAmount: '', fromAge: '' }
}

export default function Assets({ people, onComplete, onBack }) {
  // accounts[personName] = [{ name, type, currentValue, monthlyContribution }]
  const [accounts, setAccounts] = useState(
    Object.fromEntries(people.map(p => [p.name, [emptyAccount()]])),
  )
  // statePensions[personName] = { annualAmount, fromAge }
  const [statePensions, setStatePensions] = useState(
    Object.fromEntries(people.map(p => [p.name, emptyStatePension()])),
  )
  const [activeTab, setActiveTab] = useState(people[0].name)
  const [errors, setErrors] = useState({})

  function updateAccount(personName, idx, field, value) {
    setAccounts(prev => {
      const list = [...prev[personName]]
      list[idx] = { ...list[idx], [field]: value }
      return { ...prev, [personName]: list }
    })
  }

  function addAccount(personName) {
    setAccounts(prev => ({
      ...prev,
      [personName]: [...prev[personName], emptyAccount()],
    }))
  }

  function removeAccount(personName, idx) {
    setAccounts(prev => {
      const list = prev[personName].filter((_, i) => i !== idx)
      return { ...prev, [personName]: list }
    })
  }

  function updateStatePension(personName, field, value) {
    setStatePensions(prev => ({
      ...prev,
      [personName]: { ...prev[personName], [field]: value },
    }))
  }

  function hasAtLeastOneValidAccount() {
    return people.some(p =>
      accounts[p.name].some(a => {
        const val = parseFloat(a.currentValue)
        return a.name.trim() && !isNaN(val) && val > 0
      }),
    )
  }

  function buildPayload() {
    return people.map(p => {
      const sp = statePensions[p.name]
      return {
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
    })
  }

  function handleContinue() {
    if (!hasAtLeastOneValidAccount()) {
      setErrors({ general: 'Please add at least one account with a value.' })
      return
    }
    setErrors({})
    onComplete(buildPayload())
  }

  const hasMultiplePeople = people.length > 1

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Your savings and investments</h1>
          <span className="text-sm text-muted-foreground font-medium">[{activeTab}]</span>
        </div>

        {hasMultiplePeople && (
          <div className="flex space-x-1 border-b">
            {people.map(p => (
              <button
                key={p.name}
                onClick={() => setActiveTab(p.name)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === p.name
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Account rows */}
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <span className="col-span-4">Account name</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-3">Current value (£)</span>
            <span className="col-span-2">Monthly (£)</span>
            <span className="col-span-1"></span>
          </div>

          {accounts[activeTab].map((acct, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-4"
                placeholder="e.g. Workplace pension"
                value={acct.name}
                onChange={e => updateAccount(activeTab, idx, 'name', e.target.value)}
              />
              <select
                className="col-span-2 h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={acct.type}
                onChange={e => updateAccount(activeTab, idx, 'type', e.target.value)}
              >
                {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <Input
                className="col-span-3"
                type="number"
                min={0}
                placeholder="250000"
                value={acct.currentValue}
                onChange={e => updateAccount(activeTab, idx, 'currentValue', e.target.value)}
              />
              <Input
                className="col-span-2"
                type="number"
                min={0}
                placeholder="500"
                value={acct.monthlyContribution}
                onChange={e => updateAccount(activeTab, idx, 'monthlyContribution', e.target.value)}
              />
              <div className="col-span-1 flex justify-center">
                {accounts[activeTab].length > 1 && (
                  <button
                    onClick={() => removeAccount(activeTab, idx)}
                    className="text-muted-foreground hover:text-destructive text-lg leading-none"
                    aria-label="Remove account"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => addAccount(activeTab)}
          >
            + Add another account
          </Button>
        </div>

        {/* State pension */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-semibold text-foreground">State pension</h2>
          <div className="flex items-end gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="spAmount" className="text-xs text-muted-foreground">Annual amount (today&apos;s £)</Label>
              <Input
                id="spAmount"
                type="number"
                min={0}
                placeholder="11500"
                className="w-32"
                value={statePensions[activeTab].annualAmount}
                onChange={e => updateStatePension(activeTab, 'annualAmount', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spAge" className="text-xs text-muted-foreground">From age</Label>
              <Input
                id="spAge"
                type="number"
                min={55}
                max={80}
                placeholder="67"
                className="w-20"
                value={statePensions[activeTab].fromAge}
                onChange={e => updateStatePension(activeTab, 'fromAge', e.target.value)}
              />
            </div>
          </div>
        </div>

        {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}

        <div className="flex items-center justify-between pt-2">
          <Button onClick={handleContinue}>Continue</Button>
          <Button variant="outline" onClick={onBack}>← Back</Button>
        </div>
      </div>
    </div>
  )
}
