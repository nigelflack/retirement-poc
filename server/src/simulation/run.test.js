const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { runFull } = require('./run')

const config = {
  numSimulations: 1000,
  annualReturnMean: 0.07,
  annualReturnStdDev: 0.15,
  annualInflationMean: 0.025,
  annualInflationStdDev: 0.01,
}

const basePerson = {
  name: 'Alice',
  currentAge: 50,
  retirementAge: 60,
  accounts: [{ name: 'Pension', type: 'pension', currentValue: 500_000, monthlyContribution: 0 }],
}

describe('runFull', () => {
  it('withdrawalRate 0 → probabilityOfRuin is 0', () => {
    const result = runFull({ people: [basePerson], withdrawalRate: 0, toAge: 100 }, config)
    assert.equal(result.probabilityOfRuin, 0)
  })

  it('withdrawalRate 10 (1000%) → probabilityOfRuin is 1', () => {
    const result = runFull({ people: [basePerson], withdrawalRate: 10, toAge: 100 }, config)
    assert.equal(result.probabilityOfRuin, 1)
  })

  it('annualIncomeMedian is approximately real.p50 × withdrawalRate (within 20%)', () => {
    const withdrawalRate = 0.04
    const result = runFull({ people: [basePerson], withdrawalRate, toAge: 100 }, config)
    const expected = result.accumulationSnapshot.real.p50 * withdrawalRate
    const ratio = result.annualIncomeMedian / expected
    assert.ok(ratio > 0.8 && ratio < 1.2,
      `annualIncomeMedian ${result.annualIncomeMedian} not within 20% of expected ${Math.round(expected)}`)
  })

  it('survivalTable is monotonically non-increasing', () => {
    const result = runFull({ people: [basePerson], withdrawalRate: 0.04, toAge: 100 }, config)
    const table = result.survivalTable
    for (let i = 1; i < table.length; i++) {
      assert.ok(
        table[i].probabilitySolvent <= table[i - 1].probabilitySolvent,
        `survivalTable not monotone at index ${i}: ${table[i - 1].probabilitySolvent} → ${table[i].probabilitySolvent}`,
      )
    }
  })
})
