const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'

async function postJson(path, payload) {
  const response = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `Server error ${response.status}`)
  }
  return response.json()
}

export function callRun(payload) {
  return postJson('/run', payload)
}

export function callSolveIncome(payload) {
  return postJson('/solve/income', payload)
}

export function callSolveAges(payload) {
  return postJson('/solve/ages', payload)
}
