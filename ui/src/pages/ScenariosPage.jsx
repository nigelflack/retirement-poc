import { useNavigate, Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import nigelMimi from '@/scenarios/nigel-mimi.json'
import bobAlice from '@/scenarios/bob-alice.json'

const SCENARIOS = [
  { name: 'nigel-mimi', data: nigelMimi },
  { name: 'bob-alice', data: bobAlice },
]

export default function ScenariosPage() {
  const navigate = useNavigate()

  function handleLoad(scenario) {
    navigate('/', { state: { people: scenario.data.people } })
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retirement Calculator — Scenarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a scenario to load</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SCENARIOS.map(scenario => (
            <Card key={scenario.name} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{scenario.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 flex-1 justify-between">
                <p className="text-sm text-muted-foreground">
                  {scenario.data.people.length} {scenario.data.people.length === 1 ? 'person' : 'people'}
                </p>
                <Button onClick={() => handleLoad(scenario)}>Load →</Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          or{' '}
          <Link to="/" className="text-primary underline-offset-4 hover:underline">
            Start from scratch →
          </Link>
        </p>
      </div>
    </div>
  )
}

