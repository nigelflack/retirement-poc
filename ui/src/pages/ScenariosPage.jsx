import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const scenarioModules = import.meta.glob('@/scenarios/*.json', { eager: true })
const SCENARIOS = Object.entries(scenarioModules)
  .map(([path, module]) => {
    const name = path.split('/').pop().replace('.json', '')
    return { name, data: module.default }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const DEFAULT_SCENARIO = {
  label: 'New scenario',
  pots: [
    { id: 'cash_primary', type: 'cash', owner: 'person_1', accessFromAge: 0, initialValue: 0 },
  ],
  primaryPot: 'cash_primary',
  people: [
    {
      id: 'person_1',
      name: 'Person 1',
      currentAge: 40,
      retirementAge: 60,
      statePension: { annualAmount: 12000, fromAge: 67 },
    },
  ],
  incomeSchedule: [],
  expenseSchedule: [
    { id: 'core_spending', annualAmount: 36000, fromYear: 0 },
  ],
  capitalEvents: [],
  surplusStrategy: [],
  drawStrategy: [],
  toAge: 100,
}

export default function ScenariosPage() {
  const navigate = useNavigate()

  function handleLoad(scenario) {
    navigate('/scenario', { state: { scenario: scenario.data } })
  }

  function handleClone(scenario) {
    const copy = JSON.parse(JSON.stringify(scenario.data))
    const base = copy.label || scenario.name
    copy.label = `${base} (copy)`
    navigate('/scenario', { state: { scenario: copy } })
  }

  function handleCreateNew() {
    const scenario = JSON.parse(JSON.stringify(DEFAULT_SCENARIO))
    navigate('/scenario', { state: { scenario } })
  }

  function handleReload() {
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retirement Calculator — Scenarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a scenario to load</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleReload}>Reload</Button>
          <Button size="sm" onClick={handleCreateNew}>Create new</Button>
        </div>

        <div className="rounded-lg border divide-y">
          {SCENARIOS.map(scenario => (
            <div key={scenario.name} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{scenario.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {scenario.data.label || 'No label'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {scenario.data.people.length} {scenario.data.people.length === 1 ? 'person' : 'people'}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleClone(scenario)}>Clone</Button>
                <Button size="sm" onClick={() => handleLoad(scenario)}>Load</Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          or{' '}
          <Link to="/scenario" state={{ scenario: JSON.parse(JSON.stringify(DEFAULT_SCENARIO)) }} className="text-primary underline-offset-4 hover:underline">
            Start a new scenario →
          </Link>
        </p>
      </div>
    </div>
  )
}

