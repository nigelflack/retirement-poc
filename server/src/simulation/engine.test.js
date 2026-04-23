const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { simulate } = require('./engine')

const config = {
  numSimulations: 2000,
  inflation: { mean: 0.025, stdDev: 0.005 },
  returns: {
    investments: { mean: 0.07, stdDev: 0.12 },
    property:    { mean: 0.03, stdDev: 0.08 },
    cash:        { mean: 0.04, stdDev: 0.0  },
  },
}

// --- Helpers ---

function makePot(id, type, initialValue) {
  return { id, type, initialValue }
}

/**
 * Build a minimal engine input for a single-person, single-pot, flat-cashflow scenario.
 * income and expense are annual amounts in today's money.
 * retirementYear = years until retirement.
 */
function buildSimple({ initialValue = 500000, incomePerYear = 0, expensePerYear = 0,
                        retirementYear = 10, totalYears = 50,
                        capitalEvents = [], statePensionYear = null, statePensionAmount = 0 } = {}) {
  const cleanYears = Array.from({ length: totalYears }, (_, y) => {
    const income = []
    if (incomePerYear > 0) income.push({ id: 'salary', amount: incomePerYear })
    if (statePensionYear !== null && y >= statePensionYear && statePensionAmount > 0) {
      income.push({ id: 'state_pension', amount: statePensionAmount })
    }
    const expense = expensePerYear > 0 ? [{ id: 'spending', amount: expensePerYear }] : []
    const capEvent = capitalEvents.find(e => e.year === y)
    const extraCapOut = capEvent && capEvent.amount < 0
      ? [{ id: capEvent.id || 'outflow', toPot: 'portfolio', amount: Math.abs(capEvent.amount) }]
      : []
    if (capEvent && capEvent.amount > 0) {
      income.push({ id: capEvent.id || 'inflow', amount: capEvent.amount })
    }
    return {
      income,
      expense,
      capitalOut:   extraCapOut,
      capitalIn:    [],
      surplusOrder: [],
      drawOrder:    ['portfolio'],
    }
  })

  return {
    pots: [makePot('portfolio', 'investments', initialValue)],
    primaryPot: 'portfolio',
    retirementYear,
    years: cleanYears,
  }
}

// --- Deterministic tests (injectable RNG) ---

describe('simulate — deterministic (injectable RNG)', () => {
  // A constant RNG of 0 removes all random spread; each simulation path is identical.
  const constRng = () => 0

  it('two runs with the same constant RNG produce bit-for-bit identical results', () => {
    const input = buildSimple({ expensePerYear: 20000, totalYears: 40 })
    const r1 = simulate(input, config, constRng)
    const r2 = simulate(input, config, constRng)
    assert.deepEqual(r1, r2)
  })

  it('constant-RNG: zero expense → probabilityOfRuin is exactly 0', () => {
    const input = buildSimple({ expensePerYear: 0, totalYears: 40 })
    const result = simulate(input, config, constRng)
    assert.equal(result.probabilityOfRuin, 0)
  })

  it('constant-RNG: enormous expense → probabilityOfRuin is exactly 1', () => {
    const input = buildSimple({ expensePerYear: 10_000_000, totalYears: 40 })
    const result = simulate(input, config, constRng)
    assert.equal(result.probabilityOfRuin, 1)
  })

  it('constant-RNG: real p50 < nominal p50 at final year (inflation shrinks real value)', () => {
    const input = buildSimple({ expensePerYear: 5000, totalYears: 30 })
    const result = simulate(input, config, constRng)
    const last = result.portfolioPercentiles.byYear[result.portfolioPercentiles.byYear.length - 1]
    assert.ok(
      last.real[49] < last.nominal[49],
      `real p50 ${last.real[49]} should be less than nominal p50 ${last.nominal[49]}`,
    )
  })
})

// --- Stochastic behaviour tests ---

describe('simulate', () => {
  it('zero expense → probabilityOfRuin is 0', () => {
    const input = buildSimple({ expensePerYear: 0, incomePerYear: 0, totalYears: 40 })
    const result = simulate(input, config)
    assert.equal(result.probabilityOfRuin, 0)
  })

  it('enormous expense → probabilityOfRuin is 1', () => {
    const input = buildSimple({ expensePerYear: 10_000_000, incomePerYear: 0, totalYears: 40 })
    const result = simulate(input, config)
    assert.equal(result.probabilityOfRuin, 1)
  })

  it('income exactly covers expense → probabilityOfRuin is 0 (pot never needed)', () => {
    const input = buildSimple({ initialValue: 0, incomePerYear: 40000, expensePerYear: 40000, totalYears: 40 })
    const result = simulate(input, config)
    assert.equal(result.probabilityOfRuin, 0)
  })

  it('survivalTable is monotonically non-increasing', () => {
    const input = buildSimple({ expensePerYear: 30000, retirementYear: 10, totalYears: 50 })
    const result = simulate(input, config)
    const table = result.survivalTable
    for (let i = 1; i < table.length; i++) {
      assert.ok(
        table[i].probabilitySolvent <= table[i - 1].probabilitySolvent,
        `survivalTable not monotone at index ${i}`,
      )
    }
  })

  it('survivalTable has one entry per post-retirement year', () => {
    const retirementYear = 10
    const totalYears = 50
    const input = buildSimple({ retirementYear, totalYears, expensePerYear: 20000 })
    const result = simulate(input, config)
    assert.equal(result.survivalTable.length, totalYears - retirementYear)
  })

  it('portfolioPercentiles.byYear entries have nominal and real 99-element arrays', () => {
    const input = buildSimple({ expensePerYear: 20000, totalYears: 40 })
    const result = simulate(input, config)
    const entry = result.portfolioPercentiles.byYear[0]
    assert.ok(Array.isArray(entry.nominal) && entry.nominal.length === 99)
    assert.ok(Array.isArray(entry.real)    && entry.real.length    === 99)
  })

  it('portfolioPercentiles.byYear real p50 < nominal p50 (inflation deflation)', () => {
    const input = buildSimple({ expensePerYear: 10000, totalYears: 40 })
    const result = simulate(input, config)
    const last = result.portfolioPercentiles.byYear[result.portfolioPercentiles.byYear.length - 1]
    assert.ok(
      last.real[49] < last.nominal[49],
      `real p50 ${last.real[49]} should be less than nominal p50 ${last.nominal[49]}`,
    )
  })

  it('larger initial pot improves solvency vs smaller pot (same expense)', () => {
    const small = simulate(buildSimple({ initialValue: 100_000, expensePerYear: 25000, totalYears: 50 }), config)
    const large = simulate(buildSimple({ initialValue: 500_000, expensePerYear: 25000, totalYears: 50 }), config)
    assert.ok(
      large.probabilityOfRuin <= small.probabilityOfRuin,
      `larger pot should have lower ruin probability`,
    )
  })

  it('accumulationSnapshot real p50 is positive with non-zero initial pot', () => {
    const input = buildSimple({ initialValue: 300_000, expensePerYear: 10000, retirementYear: 15, totalYears: 50 })
    const result = simulate(input, config)
    assert.ok(result.accumulationSnapshot.real.p50 > 0)
  })

  it('capital inflow improves solvency vs no event', () => {
    const base    = buildSimple({ initialValue: 100_000, expensePerYear: 25000, retirementYear: 10, totalYears: 50 })
    const withIn  = buildSimple({ initialValue: 100_000, expensePerYear: 25000, retirementYear: 10, totalYears: 50,
                                  capitalEvents: [{ year: 12, amount: 100_000 }] })
    const without = simulate(base, config)
    const with_   = simulate(withIn, config)
    assert.ok(
      with_.probabilityOfRuin <= without.probabilityOfRuin,
      `capital inflow should improve solvency: ${with_.probabilityOfRuin} vs ${without.probabilityOfRuin}`,
    )
  })

  it('multi-pot: property pot grows independently (does not affect liquid solvency directly)', () => {
    const singlePot = buildSimple({ initialValue: 300_000, expensePerYear: 20000, totalYears: 50 })
    const multiPot = {
      pots: [
        makePot('portfolio', 'investments', 300_000),
        makePot('home', 'property', 400_000),
      ],
      primaryPot: 'portfolio',
      retirementYear: singlePot.retirementYear,
      years: singlePot.years,
    }
    const r1 = simulate(singlePot, config)
    const r2 = simulate(multiPot, config)
    assert.ok(
      Math.abs(r1.probabilityOfRuin - r2.probabilityOfRuin) < 0.05,
      `property pot should not affect liquid solvency`,
    )
  })

  it('surplusOrder routes surplus to secondary pot', () => {
    const totalYears = 30
    const retirementYear = 5
    const makeYears = (withSurplus) => Array.from({ length: totalYears }, (_, y) => ({
      income:      y < retirementYear ? [{ id: 'salary', amount: 80000 }] : [],
      expense:     [{ id: 'spending', amount: 20000 }],
      capitalOut:  [],
      capitalIn:   [],
      surplusOrder: (withSurplus && y < retirementYear)
        ? [{ potId: 'pension', maxAmount: 40000 }]
        : [],
      drawOrder:   ['isa', 'pension'],
    }))
    const base = {
      pots: [
        makePot('isa',     'investments', 200_000),
        makePot('pension', 'investments', 100_000),
      ],
      primaryPot: 'isa',
      retirementYear,
    }
    const withSurplus    = simulate({ ...base, years: makeYears(true) },  config)
    const withoutSurplus = simulate({ ...base, years: makeYears(false) }, config)
    assert.ok(
      withSurplus.probabilityOfRuin <= withoutSurplus.probabilityOfRuin + 0.05,
      `surplusOrder routing should not increase ruin (${withSurplus.probabilityOfRuin} vs ${withoutSurplus.probabilityOfRuin})`,
    )
  })

  it('drawOrder: pension not accessible → ISA used first, ruin occurs when ISA exhausted', () => {
    const totalYears = 30
    const retirementYear = 5
    const years = Array.from({ length: totalYears }, (_, y) => ({
      income:      [],
      expense:     [{ id: 'spending', amount: 40000 }],
      capitalOut:  [],
      capitalIn:   [],
      surplusOrder: [],
      drawOrder:   ['isa'], // pension deliberately excluded
    }))
    const input = {
      pots: [
        makePot('isa',     'investments',  20_000),
        makePot('pension', 'investments', 500_000),
      ],
      primaryPot: 'isa',
      retirementYear,
      years,
    }
    const result = simulate(input, config)
    assert.ok(
      result.probabilityOfRuin > 0.5,
      `should show ruin when pension is excluded from drawOrder despite being large`,
    )
  })

  it('netWorthPercentiles: response includes netWorthPercentiles with byAge entries', () => {
    const input = buildSimple({ initialValue: 300_000, expensePerYear: 20000, totalYears: 40 })
    const result = simulate(input, config)
    assert.ok(result.netWorthPercentiles)
    assert.ok(Array.isArray(result.netWorthPercentiles.byAge))
    assert.equal(result.netWorthPercentiles.byAge.length, 40)
  })

  it('netWorthPercentiles: each entry has liquid, nonLiquid, and total sub-objects with real arrays only', () => {
    const input = buildSimple({ initialValue: 300_000, expensePerYear: 20000, totalYears: 40 })
    const result = simulate(input, config)
    const entry = result.netWorthPercentiles.byAge[0]
    assert.ok(entry.liquid && Array.isArray(entry.liquid.real) && !entry.liquid.nominal)
    assert.ok(entry.nonLiquid && Array.isArray(entry.nonLiquid.real) && !entry.nonLiquid.nominal)
    assert.ok(entry.total && Array.isArray(entry.total.real) && !entry.total.nominal)
  })

  it('netWorthPercentiles: total ≈ liquid + nonLiquid (p50 check)', () => {
    const input = {
      pots: [
        makePot('portfolio', 'investments', 300_000),
        makePot('home', 'property', 500_000),
      ],
      primaryPot: 'portfolio',
      retirementYear: 10,
      years: Array.from({ length: 40 }, (_, y) => ({
        income:      y < 10 ? [{ id: 'salary', amount: 50000 }] : [],
        expense:     [{ id: 'spending', amount: 30000 }],
        capitalOut:  [],
        capitalIn:   [],
        surplusOrder: [],
        drawOrder:   ['portfolio'],
      })),
    }
    const result = simulate(input, config)
    const entry = result.netWorthPercentiles.byAge[20]
    const liquidP50 = entry.liquid.real[49]
    const nonLiquidP50 = entry.nonLiquid.real[49]
    const totalP50 = entry.total.real[49]
    const sum = liquidP50 + nonLiquidP50
    // Allow ~5% tolerance due to independent percentile calculations across simulation paths
    const tolerance = totalP50 * 0.05
    assert.ok(
      Math.abs(totalP50 - sum) <= tolerance,
      `total p50 (${totalP50}) should ≈ liquid p50 (${liquidP50}) + nonLiquid p50 (${nonLiquidP50}), diff: ${Math.abs(totalP50 - sum)}, tolerance: ${tolerance}`,
    )
  })
})

// --- v0.21: grossUpFactor, tax/NI as expense, employer pension routing ---

describe('surplus grossUpFactor (relief-at-source)', () => {
  it('grossUpFactor 1.25 causes pension pot to receive more than net contribution', () => {
    const constRng = () => 0
    const totalYears = 6
    const retirementYear = 3
    const makeYears = (withGrossUp) => Array.from({ length: totalYears }, (_, y) => ({
      income:      y < retirementYear ? [{ id: 'salary', amount: 60000 }] : [],
      expense:     [{ id: 'spending', amount: 20000 }],
      capitalOut:  [],
      capitalIn:   [],
      surplusOrder: y < retirementYear
        ? [{ potId: 'pension', maxAmount: 30000, ...(withGrossUp ? { grossUpFactor: 1.25 } : {}) }]
        : [],
      drawOrder: ['pension'],
    }))
    const base = {
      pots: [
        makePot('cash',    'cash',        200_000),
        makePot('pension', 'investments', 0),
      ],
      primaryPot: 'cash',
      retirementYear,
    }
    const withGrossUp    = simulate({ ...base, years: makeYears(true) },  config, constRng)
    const withoutGrossUp = simulate({ ...base, years: makeYears(false) }, config, constRng)
    assert.ok(
      withGrossUp.probabilityOfRuin <= withoutGrossUp.probabilityOfRuin,
      `grossUpFactor 1.25 should improve or match solvency vs no gross-up`,
    )
  })

  it('grossUpFactor 1.0 (explicit) behaves identically to no grossUpFactor field', () => {
    const constRng = () => 0
    const totalYears = 6
    const retirementYear = 3
    const makeYears = (factor) => Array.from({ length: totalYears }, (_, y) => ({
      income:      y < retirementYear ? [{ id: 'salary', amount: 60000 }] : [],
      expense:     [{ id: 'spending', amount: 20000 }],
      capitalOut:  [],
      capitalIn:   [],
      surplusOrder: y < retirementYear
        ? [{ potId: 'pension', maxAmount: 20000, ...(factor != null ? { grossUpFactor: factor } : {}) }]
        : [],
      drawOrder: ['pension'],
    }))
    const base = { pots: [makePot('cash', 'cash', 200_000), makePot('pension', 'investments', 0)], primaryPot: 'cash', retirementYear }
    const r1 = simulate({ ...base, years: makeYears(1.0) }, config, constRng)
    const r2 = simulate({ ...base, years: makeYears(null) }, config, constRng)
    assert.deepEqual(r1.probabilityOfRuin, r2.probabilityOfRuin)
  })
})

describe('v0.22 engine features', () => {
  it('depreciating pot loses value deterministically at annualDepreciationPct', () => {
    const constRng = () => 0
    const input = {
      pots: [
        { id: 'cash', type: 'cash', initialValue: 0 },
        { id: 'car', type: 'depreciating', initialValue: 100000, annualDepreciationPct: 0.10 },
      ],
      primaryPot: 'cash',
      retirementYear: 1,
      years: Array.from({ length: 2 }, () => ({
        income: [],
        expense: [],
        capitalOut: [],
        capitalIn: [],
        surplusOrder: [],
        drawOrder: ['cash'],
      })),
    }

    const result = simulate(input, config, constRng)
    const year1 = result.netWorthPercentiles.byAge[0].nonLiquid.real[49]
    const year2 = result.netWorthPercentiles.byAge[1].nonLiquid.real[49]
    assert.equal(year1, 87806)
    assert.equal(year2, 77099)
  })

  it('capitalIn haircut transfers discounted proceeds from source pot', () => {
    const constRng = () => 0
    const input = {
      pots: [
        { id: 'cash', type: 'cash', initialValue: 0 },
        { id: 'car', type: 'depreciating', initialValue: 100000, annualDepreciationPct: 0 },
      ],
      primaryPot: 'cash',
      retirementYear: 1,
      years: [
        {
          income: [],
          expense: [],
          capitalOut: [],
          capitalIn: [{ id: 'sell_car', fromPot: 'car', haircut: 0.2 }],
          surplusOrder: [],
          drawOrder: ['cash'],
        },
      ],
    }

    const result = simulate(input, config, constRng)
    const liquidP50 = result.netWorthPercentiles.byAge[0].liquid.real[49]
    const nonLiquidP50 = result.netWorthPercentiles.byAge[0].nonLiquid.real[49]
    assert.equal(liquidP50, 81172)
    assert.equal(nonLiquidP50, 19512)
  })

  it('potPercentiles: response includes byYear entries with realP50 per pot', () => {
    const constRng = () => 0
    const input = {
      pots: [
        { id: 'cash', type: 'cash', initialValue: 50000 },
        { id: 'pension', type: 'investments', initialValue: 100000 },
      ],
      primaryPot: 'cash',
      retirementYear: 2,
      years: Array.from({ length: 4 }, () => ({
        income: [],
        expense: [],
        capitalOut: [],
        capitalIn: [],
        surplusOrder: [],
        drawOrder: ['cash', 'pension'],
      })),
    }
    const result = simulate(input, config, constRng)
    assert.ok(result.potPercentiles, 'potPercentiles should exist')
    assert.ok(Array.isArray(result.potPercentiles.byYear), 'byYear should be an array')
    assert.equal(result.potPercentiles.byYear.length, 4)
    const entry = result.potPercentiles.byYear[0]
    assert.ok(entry.byPot, 'byPot should exist')
    assert.ok('cash' in entry.byPot, 'cash pot should be present')
    assert.ok('pension' in entry.byPot, 'pension pot should be present')
    assert.ok(typeof entry.byPot.cash.realP50 === 'number', 'realP50 should be a number')
  })
})

describe('tax and NI as expense items', () => {
  it('adding a tax expense item reduces primary pot vs no tax', () => {
    const constRng = () => 0
    const totalYears = 20
    const retirementYear = 5
    const makeYears = (withTax) => Array.from({ length: totalYears }, (_, y) => ({
      income:      y < retirementYear ? [{ id: 'salary', amount: 60000 }] : [],
      expense:     [
        { id: 'spending', amount: 20000 },
        ...(withTax && y < retirementYear ? [{ id: 'income_tax', amount: 12000 }] : []),
      ],
      capitalOut:  [],
      capitalIn:   [],
      surplusOrder: [],
      drawOrder:   ['portfolio'],
    }))
    const base = { pots: [makePot('portfolio', 'investments', 300_000)], primaryPot: 'portfolio', retirementYear }
    const withTax    = simulate({ ...base, years: makeYears(true) },  config, constRng)
    const withoutTax = simulate({ ...base, years: makeYears(false) }, config, constRng)
    assert.ok(
      withTax.probabilityOfRuin >= withoutTax.probabilityOfRuin,
      `tax expense should not improve solvency`,
    )
  })

  it('adding an NI expense item further reduces solvency vs tax only', () => {
    const constRng = () => 0
    const totalYears = 20
    const retirementYear = 5
    const makeYears = (withNI) => Array.from({ length: totalYears }, (_, y) => ({
      income:      y < retirementYear ? [{ id: 'salary', amount: 60000 }] : [],
      expense:     [
        { id: 'spending', amount: 20000 },
        { id: 'income_tax', amount: 12000 },
        ...(withNI && y < retirementYear ? [{ id: 'ni', amount: 3000 }] : []),
      ],
      capitalOut:  [],
      capitalIn:   [],
      surplusOrder: [],
      drawOrder:   ['portfolio'],
    }))
    const base = { pots: [makePot('portfolio', 'investments', 300_000)], primaryPot: 'portfolio', retirementYear }
    const withNI    = simulate({ ...base, years: makeYears(true) },  config, constRng)
    const withoutNI = simulate({ ...base, years: makeYears(false) }, config, constRng)
    assert.ok(
      withNI.probabilityOfRuin >= withoutNI.probabilityOfRuin,
      `NI expense should not improve solvency`,
    )
  })

  it('employer pension contribution pattern: income + capitalOut → primary pot unchanged, pension grows', () => {
    const constRng = () => 0
    const totalYears = 6
    const retirementYear = 3
    // Employer adds 10000 as non-taxable income then routes same amount out to pension.
    // Primary pot net change from employer contribution = 0.
    // Pension receives 10000 per year.
    const yearsWithEmployer = Array.from({ length: totalYears }, (_, y) => ({
      income:      y < retirementYear
        ? [{ id: 'salary', amount: 50000 }, { id: 'emp_pension', amount: 10000, taxable: false }]
        : [],
      expense:     [{ id: 'spending', amount: 20000 }],
      capitalOut:  y < retirementYear ? [{ id: 'emp_pension', toPot: 'pension', amount: 10000 }] : [],
      capitalIn:   [],
      surplusOrder: [],
      drawOrder:   ['pension'],
    }))
    const yearsWithout = Array.from({ length: totalYears }, (_, y) => ({
      income:      y < retirementYear ? [{ id: 'salary', amount: 50000 }] : [],
      expense:     [{ id: 'spending', amount: 20000 }],
      capitalOut:  [],
      capitalIn:   [],
      surplusOrder: [],
      drawOrder:   ['pension'],
    }))
    const base = {
      pots: [makePot('cash', 'cash', 100_000), makePot('pension', 'investments', 0)],
      primaryPot: 'cash',
      retirementYear,
    }
    const withEmployer = simulate({ ...base, years: yearsWithEmployer }, config, constRng)
    const without      = simulate({ ...base, years: yearsWithout      }, config, constRng)
    // Employer routing should improve or match solvency (more assets available in drawdown).
    assert.ok(
      withEmployer.probabilityOfRuin <= without.probabilityOfRuin,
      `employer pension routing should not worsen solvency`,
    )
  })
})
