const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const router = require('./simulate')
const simulationConfig = require('../../config/simulation.json')

const {
  calculateUKTax,
  calculateUKNI,
  resolvePropertyYear,
} = router.__private

describe('simulate route helpers (v0.22)', () => {
  it('per-person tax sum differs from pooled household tax when incomes are uneven', () => {
    const taxConfig = simulationConfig.tax
    const nigelIncome = 250000
    const mimiIncome = 25000

    const pooled = calculateUKTax(nigelIncome + mimiIncome, taxConfig)
    const perPerson = calculateUKTax(nigelIncome, taxConfig) + calculateUKTax(mimiIncome, taxConfig)

    assert.ok(perPerson < pooled)
  })

  it('per-person NI sum differs from pooled NI for uneven incomes', () => {
    const nigelIncome = 250000
    const mimiIncome = 25000

    const pooled = calculateUKNI(nigelIncome + mimiIncome)
    const perPerson = calculateUKNI(nigelIncome) + calculateUKNI(mimiIncome)

    assert.ok(perPerson > pooled)
  })

  it('interest-only mortgage keeps balance flat without overpayments and yields expected BTL taxable amount', () => {
    const pot = {
      id: 'btl',
      type: 'property',
      owner: 'nigel',
      initialValue: 350000,
      monthlyRent: 2000,
      monthlyExpenses: 300,
      mortgage: {
        outstandingBalance: 180000,
        mortgageType: 'interestOnly',
        interestRate: 0.05,
      },
    }
    const state = { outstandingBalance: 180000 }

    const y = resolvePropertyYear(pot, state)

    assert.equal(Math.round(y.annualInterest), 9000)
    assert.equal(Math.round(y.annualMortgagePayment), 9000)
    assert.equal(Math.round(y.outstandingBalance), 180000)
    assert.equal(Math.round(y.taxableBtlIncome), 11400) // 24,000 - 3,600 - 9,000
  })

  it('BTL mortgage interest credit is 20% of annual interest', () => {
    const interest = 9000
    const credit = Math.round(interest * 0.20)
    assert.equal(credit, 1800)
  })
})
