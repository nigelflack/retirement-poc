const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'

export async function callRun(payload) {
  const response = await fetch(`${SERVER_URL}/run`, {
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
