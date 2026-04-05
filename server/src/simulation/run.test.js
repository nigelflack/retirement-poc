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

/**
 * Build flat dense arrays for a single person, single income target — the simple case.
 */
function buildFlatInput(people, annualSpendingTarget, toAge) {
  const earliest = people.reduce((best, p) =>
    (p.retirementAge - p.currentAge) < (best.retirementAge - best.currentAge) ? p : best
  )
  const householdRetirementYear = earliest.retirementAge - earliest.currentAge
  const totalYears = householdRetirementYear + (toAge - earliest.retirementAge)

  const contributionByYear = people.map(p => {
    const flat = p.accounts.reduce((s, a) => s + (a.monthlyContribution || 0), 0) * 12
    const personRetirementYear = p.retirementAge - p.currentAge
    return Array.from({ length: totalYears }, (_, y) => (y < personRetirementYear ? flat : 0))
  })

  const spendingTargetByYear = Array.from({ length: totalYears }, (_, y) =>
    y >= householdRetirementYear ? annualSpendingTarget : 0
  )

  const capitalEventsByYear = new Array(totalYears).fill(0)
  const otherIncomeByYear = new Array(totalYears).fill(0)

  return { people, contributionByYear, spendingTargetByYear, capitalEventsByYear, otherIncomeByYear, toAge }
}

describe('runFull', () => {
  it('annualSpendingTarget 0 → probabilityOfRuin is 0', () => {
    const result = runFull(buildFlatInput([basePerson], 0, 100), config)
    assert.equal(result.probabilityOfRuin, 0)
  })

  it('annualSpendingTarget very large → probabilityOfRuin is 1', () => {
    const result = runFull(buildFlatInput([basePerson], 10_000_000, 100), config)
    assert.equal(result.probabilityOfRuin, 1)
  })

  it('annualIncomeMedian is approximately annualSpendingTarget (within 20%)', () => {
    const annualSpendingTarget = 20000
    const result = runFull(buildFlatInput([basePerson], annualSpendingTarget, 100), config)
    const ratio = result.annualIncomeMedian / annualSpendingTarget
    assert.ok(ratio > 0.8 && ratio < 1.2,
      `annualIncomeMedian ${result.annualIncomeMedian} not within 20% of target ${annualSpendingTarget}`)
  })

  it('survivalTable is monotonically non-increasing', () => {
    const result = runFull(buildFlatInput([basePerson], 20000, 100), config)
    const table = result.survivalTable
    for (let i = 1; i < table.length; i++) {
      assert.ok(
        table[i].probabilitySolvent <= table[i - 1].probabilitySolvent,
        `survivalTable not monotone at index ${i}: ${table[i - 1].probabilitySolvent} → ${table[i].probabilitySolvent}`,
      )
    }
  })

  it('survivalTable has one entry per drawdown year', () => {
    const toAge = 90
    const result = runFull(buildFlatInput([basePerson], 20000, toAge), config)
    const expectedEntries = toAge - basePerson.retirementAge
    assert.equal(result.survivalTable.length, expectedEntries,
      `expected ${expectedEntries} entries, got ${result.survivalTable.length}`)
    assert.equal(result.survivalTable[0].age, basePerson.retirementAge + 1)
    assert.equal(result.survivalTable[expectedEntries - 1].age, toAge)
  })

  it('portfolioPercentiles.byAge entries have both nominal and real fields', () => {
    const result = runFull(buildFlatInput([basePerson], 20000, 100), config)
    const entry = result.portfolioPercentiles.byAge[0]
    assert.ok(Array.isArray(entry.nominal) && entry.nominal.length === 99, 'nominal should be 99-element array')
    assert.ok(Array.isArray(entry.real) && entry.real.length === 99, 'real should be 99-element array')
  })

  it('portfolioPercentiles.byAge real p50 is less than nominal p50 (inflation deflation)', () => {
    const result = runFull(buildFlatInput([basePerson], 20000, 100), config)
    const lastEntry = result.portfolioPercentiles.byAge[result.portfolioPercentiles.byAge.length - 1]
    assert.ok(lastEntry.real[49] < lastEntry.nominal[49],
      `real p50 ${lastEntry.real[49]} should be less than nominal p50 ${lastEntry.nominal[49]}`)
  })

  it('contributionSchedule step-up produces higher median pot at retirement', () => {
    const toAge = 100
    const earliest = basePerson
    const householdRetirementYear = earliest.retirementAge - earliest.currentAge
    const totalYears = householdRetirementYear + (toAge - earliest.retirementAge)

    // Low contribution throughout
    const lowContrib = Array.from({ length: totalYears }, (_, y) => (y < householdRetirementYear ? 6000 : 0))
    // Step up halfway through accumulation
    const halfYear = Math.floor(householdRetirementYear / 2)
    const highContrib = Array.from({ length: totalYears }, (_, y) =>
      y < householdRetirementYear ? (y < halfYear ? 6000 : 18000) : 0
    )
    const spendingTargetByYear = new Array(totalYears).fill(0)
    const capitalEventsByYear = new Array(totalYears).fill(0)
    const otherIncomeByYear = new Array(totalYears).fill(0)

    const low = runFull({ people: [basePerson], contributionByYear: [lowContrib], spendingTargetByYear, capitalEventsByYear, otherIncomeByYear, toAge }, config)
    const high = runFull({ people: [basePerson], contributionByYear: [highContrib], spendingTargetByYear, capitalEventsByYear, otherIncomeByYear, toAge }, config)

    assert.ok(
      high.accumulationSnapshot.real.p50 > low.accumulationSnapshot.real.p50,
      `higher contribution should produce higher p50: ${high.accumulationSnapshot.real.p50} vs ${low.accumulationSnapshot.real.p50}`
    )
  })

  it('capital inflow improves solvency vs no event', () => {
    const toAge = 100
    const income = 25000
    const noEvent = buildFlatInput([basePerson], income, toAge)
    const withInflow = { ...noEvent, capitalEventsByYear: noEvent.capitalEventsByYear.slice() }
    withInflow.capitalEventsByYear[basePerson.retirementAge - basePerson.currentAge] = 100000

    const without = runFull(noEvent, config)
    const with_ = runFull(withInflow, config)

    assert.ok(
      with_.probabilityOfRuin <= without.probabilityOfRuin,
      `inflow should improve or maintain solvency: ${with_.probabilityOfRuin} vs ${without.probabilityOfRuin}`
    )
  })

  it('otherIncomeByYear reduces draw and improves solvency vs no income stream', () => {
    const toAge = 100
    const income = 25000
    const noStream = buildFlatInput([basePerson], income, toAge)
    const withStream = { ...noStream, otherIncomeByYear: noStream.otherIncomeByYear.slice() }
    // £5,000/yr income stream active throughout drawdown
    const householdRetirementYear = basePerson.retirementAge - basePerson.currentAge
    const totalYears = householdRetirementYear + (toAge - basePerson.retirementAge)
    for (let y = householdRetirementYear; y < totalYears; y++) {
      withStream.otherIncomeByYear[y] = 5000
    }

    const without = runFull(noStream, config)
    const with_ = runFull(withStream, config)

    assert.ok(
      with_.probabilityOfRuin <= without.probabilityOfRuin,
      `income stream should improve or maintain solvency: ${with_.probabilityOfRuin} vs ${without.probabilityOfRuin}`
    )
  })

  it('otherIncomeByYear covering full spending target → probabilityOfRuin is 0', () => {
    const toAge = 100
    const income = 20000
    const base = buildFlatInput([basePerson], income, toAge)
    const fullCover = { ...base, otherIncomeByYear: base.otherIncomeByYear.slice() }
    // Cover entire spending target every year
    for (let y = 0; y < fullCover.otherIncomeByYear.length; y++) {
      fullCover.otherIncomeByYear[y] = income
    }

    const result = runFull(fullCover, config)
    assert.equal(result.probabilityOfRuin, 0,
      `full income cover should give 0 ruin probability, got ${result.probabilityOfRuin}`)
  })
})
