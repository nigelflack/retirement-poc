const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { sampleNormal, logNormalParams, percentile, interpolateSolventAt } = require('./math')

describe('sampleNormal', () => {
  it('produces samples with mean ≈ 0 and std dev ≈ 1 over 10,000 draws', () => {
    const n = 10_000
    const samples = Array.from({ length: n }, sampleNormal)
    const mean = samples.reduce((s, x) => s + x, 0) / n
    const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)
    assert.ok(Math.abs(mean) < 0.05, `mean ${mean.toFixed(4)} not within ±0.05 of 0`)
    assert.ok(Math.abs(stdDev - 1) < 0.05, `std dev ${stdDev.toFixed(4)} not within ±0.05 of 1`)
  })
})

describe('logNormalParams', () => {
  it('returns correct mu and sigma for known inputs', () => {
    const mean = 0.07
    const stdDev = 0.15
    const { muLn, sigmaLn } = logNormalParams(mean, stdDev)
    const sigmaLn2 = Math.log(1 + (stdDev / (1 + mean)) ** 2)
    const expectedSigma = Math.sqrt(sigmaLn2)
    const expectedMu = Math.log(1 + mean) - sigmaLn2 / 2
    assert.ok(Math.abs(muLn - expectedMu) < 1e-10, `muLn mismatch: ${muLn} vs ${expectedMu}`)
    assert.ok(Math.abs(sigmaLn - expectedSigma) < 1e-10, `sigmaLn mismatch: ${sigmaLn} vs ${expectedSigma}`)
  })

  it('returns sigma > 0 and mu < ln(1+mean) for positive inputs', () => {
    const { muLn, sigmaLn } = logNormalParams(0.05, 0.10)
    assert.ok(sigmaLn > 0)
    assert.ok(muLn < Math.log(1.05))
  })
})

describe('percentile', () => {
  const sorted = [1, 2, 3, 4, 5]

  it('p50 of [1,2,3,4,5] is 3', () => {
    assert.equal(percentile(sorted, 50), 3)
  })

  it('p0 returns the minimum', () => {
    assert.equal(percentile(sorted, 0), 1)
  })

  it('p100 returns the maximum', () => {
    assert.equal(percentile(sorted, 100), 5)
  })
})

describe('interpolateSolventAt', () => {
  const table = [
    { age: 70, probabilitySolvent: 1.0 },
    { age: 75, probabilitySolvent: 0.9 },
    { age: 80, probabilitySolvent: 0.7 },
    { age: 85, probabilitySolvent: 0.5 },
    { age: 90, probabilitySolvent: 0.3 },
  ]

  it('returns exact value when age matches a table entry', () => {
    assert.equal(interpolateSolventAt(table, 80), 0.7)
  })

  it('interpolates linearly between two entries', () => {
    // halfway between 75 (0.9) and 80 (0.7) → 0.8
    const result = interpolateSolventAt(table, 77.5)
    assert.ok(Math.abs(result - 0.8) < 1e-10, `expected 0.8, got ${result}`)
  })

  it('returns the first entry value when target is below the table range', () => {
    assert.equal(interpolateSolventAt(table, 65), 1.0)
  })

  it('returns the last entry value when target is above the table range', () => {
    assert.equal(interpolateSolventAt(table, 95), 0.3)
  })

  it('returns null for empty table', () => {
    assert.equal(interpolateSolventAt([], 90), null)
  })
})
