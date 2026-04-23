const express = require('express');
const router = express.Router();
const { simulate } = require('../simulation/engine');
const simulationConfig = require('../../config/simulation.json');

/**
 * Adapter: resolves the high-level POST /simulate request body into the
 * year-array format required by the engine, then runs the simulation.
 *
 * High-level request fields:
 *   pots[]            — { id, type, owner?, accessFromAge, initialValue }
 *   primaryPot        — pot id receiving net cashflow each year
 *   people[]          — { id, name, currentAge, retirementAge, statePension? }
 *   incomeSchedule[]  — { id, annualAmount, fromYear, toYear?, taxable? }
 *   expenseSchedule[] — { id, annualAmount, fromYear, toYear? }
 *   capitalEvents[]   — { id, year, amount, toPot? }
 *   surplusStrategy[] — { potId, annualCap }
 *   drawStrategy[]    — [potId, ...]  (ordered draw priority)
 *   toAge             — simulation horizon age (default 100)
 *   debug             — if true, include resolvedYears in response
 */

// --- Tax calculation helpers ---

/**
 * Calculate UK-style income tax for a given gross income.
 * Applies progressive tax bands and personal allowance taper.
 *
 * Fix: the first taxed band (basic rate) starts at the personal allowance,
 * not at the band's nominal floor. This matters when the allowance is tapered
 * below its standard value (e.g. £7,570 at £110k income).
 */
function calculateUKTax(income, taxConfig) {
  const { bands, personalAllowanceTaper } = taxConfig;

  // bands[1].floor is the standard personal allowance amount
  const standardAllowance = bands[1] ? bands[1].floor : 12570;
  let allowance = standardAllowance;

  if (personalAllowanceTaper && income > personalAllowanceTaper.incomeThreshold) {
    const excessIncome = income - personalAllowanceTaper.incomeThreshold;
    allowance = Math.max(0, allowance - excessIncome * personalAllowanceTaper.taperRate);
  }

  let tax = 0;
  for (let i = 1; i < bands.length; i++) {
    const band = bands[i];
    // The first non-zero band starts at the personal allowance (not necessarily band.floor).
    // Higher bands start at their statutory floor regardless.
    const effectiveStart = i === 1 ? allowance : band.floor;
    if (income <= effectiveStart) continue;
    const nextFloor = i < bands.length - 1 ? bands[i + 1].floor : Infinity;
    const taxableInBand = Math.min(income, nextFloor) - effectiveStart;
    if (taxableInBand > 0) tax += taxableInBand * band.rate;
  }

  return Math.round(tax);
}

/**
 * Calculate UK Class 1 employee National Insurance on employment income.
 * Bands (2025/26): 0% up to £12,570; 8% on £12,570–£50,270; 2% above £50,270.
 */
function calculateUKNI(income) {
  const lower = 12570;
  const upper = 50270;
  if (income <= lower) return 0;
  let ni = (Math.min(income, upper) - lower) * 0.08;
  if (income > upper) ni += (income - upper) * 0.02;
  return Math.round(ni);
}

/**
 * Return the statutory marginal income tax rate for a given gross income.
 * Used to compute higher/additional-rate relief on pension contributions.
 */
function getMarginalRate(income, taxConfig) {
  const { bands, personalAllowanceTaper } = taxConfig;
  const standardAllowance = bands[1] ? bands[1].floor : 12570;
  let allowance = standardAllowance;

  if (personalAllowanceTaper && income > personalAllowanceTaper.incomeThreshold) {
    const excessIncome = income - personalAllowanceTaper.incomeThreshold;
    allowance = Math.max(0, allowance - excessIncome * personalAllowanceTaper.taperRate);
  }

  if (income <= allowance) return 0;

  for (let i = bands.length - 1; i >= 1; i--) {
    const effectiveFloor = i === 1 ? allowance : bands[i].floor;
    if (income > effectiveFloor) return bands[i].rate;
  }

  return 0;
}

/**
 * Detect if estimated pension contributions might exceed taper threshold.
 */
function detectTaperWarnings(years, surplusStrategy, pots, taxConfig) {
  const warnings = [];
  const taperedThreshold = taxConfig.taperedAllowanceThreshold || 60000;
  const warningYears = [];

  for (let y = 0; y < years.length; y++) {
    const yr = years[y];
    let pensionContribution = 0;
    
    // Estimate pension contributions from surplus strategy
    if (yr.surplusOrder) {
      for (const surplus of yr.surplusOrder) {
        const pot = pots.find(p => p.id === surplus.potId);
        if (pot && (pot.type === 'investments' || pot.id.includes('pension'))) {
          pensionContribution += surplus.maxAmount;
        }
      }
    }
    
    // Check if income + pension contributions exceed threshold
    let grossIncome = 0;
    if (yr.income) {
      for (const inc of yr.income) {
        if (inc.taxable) grossIncome += inc.amount;
      }
    }
    
    if (grossIncome + pensionContribution > taperedThreshold) {
      warningYears.push(y);
    }
  }

  if (warningYears.length > 0) {
    const startYear = warningYears[0];
    const endYear = warningYears[warningYears.length - 1];
    warnings.push(`Estimated pension contribution exceeds tapered allowance threshold in years ${startYear}–${endYear}`);
  }

  return { warnings, warningYears };
}

function getIncomeBucket(ownerId) {
  return ownerId || '__household__';
}

function roundAmount(value) {
  return Math.round(value);
}

function resolvePropertyYear(pot, state) {
  const mortgage = pot.mortgage || {};
  const mortgageType = mortgage.mortgageType || 'repayment';
  const interestRate = mortgage.interestRate || 0;
  const annualPayment = mortgage.annualPayment || 0;
  const monthlyRent = pot.monthlyRent || 0;
  const monthlyExpenses = pot.monthlyExpenses || 0;

  const annualRent = monthlyRent * 12;
  const annualOperatingExpenses = monthlyExpenses * 12;

  let annualInterest = 0;
  let overpayment = 0;
  let annualMortgagePayment = 0;

  if (state.outstandingBalance > 0) {
    annualInterest = state.outstandingBalance * interestRate;
    overpayment = mortgage.overpaymentAnnual != null
      ? mortgage.overpaymentAnnual
      : (mortgage.overpaymentPct || 0) * state.outstandingBalance;

    if (mortgageType === 'interestOnly') {
      // Interest-only mortgage keeps principal flat unless optional overpayment is set.
      annualMortgagePayment = annualInterest + overpayment;
      state.outstandingBalance = Math.max(0, state.outstandingBalance - overpayment);
    } else {
      const plannedPayment = annualPayment + overpayment;
      const maxPayoffPayment = state.outstandingBalance + annualInterest;
      annualMortgagePayment = Math.min(plannedPayment, maxPayoffPayment);
      const principalPaid = Math.max(0, annualMortgagePayment - annualInterest);
      state.outstandingBalance = Math.max(0, state.outstandingBalance - principalPaid);
    }
  }

  const taxableBtlIncome = annualRent - annualOperatingExpenses - annualMortgagePayment;

  return {
    annualRent,
    annualOperatingExpenses,
    annualInterest,
    annualMortgagePayment,
    taxableBtlIncome,
    outstandingBalance: state.outstandingBalance,
  };
}

router.post('/', (req, res) => {
  const {
    pots,
    primaryPot,
    people,
    incomeSchedule = [],
    expenseSchedule = [],
    capitalEvents = [],
    surplusStrategy = [],
    drawStrategy = [],
    toAge = 100,
    debug = false,
  } = req.body;

  // --- Validation ---
  if (!Array.isArray(pots) || pots.length === 0) {
    return res.status(400).json({ error: 'pots must be a non-empty array' });
  }
  for (const pot of pots) {
    if (!pot.id || !pot.type || pot.initialValue == null) {
      return res.status(400).json({ error: 'Each pot must have id, type, and initialValue' });
    }
    if (!['investments', 'property', 'cash', 'depreciating'].includes(pot.type)) {
      return res.status(400).json({ error: `Unknown pot type '${pot.type}'` });
    }
  }
  if (!primaryPot || !pots.find(p => p.id === primaryPot)) {
    return res.status(400).json({ error: 'primaryPot must reference a valid pot id' });
  }
  if (!Array.isArray(people) || people.length === 0) {
    return res.status(400).json({ error: 'people must be a non-empty array' });
  }
  for (const person of people) {
    if (!person.id || !person.name || person.currentAge == null || person.retirementAge == null) {
      return res.status(400).json({ error: 'Each person must have id, name, currentAge, retirementAge' });
    }
    if (person.retirementAge <= person.currentAge) {
      return res.status(400).json({ error: `retirementAge must be > currentAge for ${person.name}` });
    }
  }
  if (typeof toAge !== 'number' || toAge <= 0) {
    return res.status(400).json({ error: 'toAge must be a positive number' });
  }

  // --- Derive simulation horizon ---
  // Use the oldest person's currentAge as the reference; toAge is their age.
  // retirementYear = earliest (fewest years to retire).
  const earliest = people.reduce((best, p) =>
    (p.retirementAge - p.currentAge) < (best.retirementAge - best.currentAge) ? p : best
  );
  const retirementYear = earliest.retirementAge - earliest.currentAge;
  const totalYears = toAge - earliest.currentAge;

  if (totalYears <= 0) {
    return res.status(400).json({ error: 'toAge must be greater than the oldest person\'s currentAge' });
  }

  // Build pot-id → accessFromYear lookup (0 if no owner or accessFromAge=0).
  const potAccessYear = {};
  for (const pot of pots) {
    if (pot.accessFromAge == null || pot.accessFromAge === 0) {
      potAccessYear[pot.id] = 0;
    } else if (pot.owner) {
      const owner = people.find(p => p.id === pot.owner);
      potAccessYear[pot.id] = owner ? Math.max(0, pot.accessFromAge - owner.currentAge) : 0;
    } else {
      potAccessYear[pot.id] = 0;
    }
  }

  // Build retirement year per person (for surplus strategy exclusion).
  const personRetirementYear = {};
  for (const p of people) {
    personRetirementYear[p.id] = p.retirementAge - p.currentAge;
  }

  // Owner lookup for each pot.
  const potOwner = {};
  for (const pot of pots) {
    if (pot.owner) potOwner[pot.id] = pot.owner;
  }

  // Property mortgage runtime state (in today's money terms).
  const propertyState = {};
  for (const pot of pots) {
    if (pot.type !== 'property') continue;
    propertyState[pot.id] = {
      outstandingBalance: pot.mortgage && pot.mortgage.outstandingBalance
        ? pot.mortgage.outstandingBalance
        : 0,
    };
  }

  // --- Synthesise state pension income schedule entries ---
  // State pensions are injected as incomeSchedule items by the adapter.
  const syntheticIncome = [...incomeSchedule];
  for (const person of people) {
    if (person.statePension) {
      const { annualAmount, fromAge } = person.statePension;
      const fromYear = fromAge - person.currentAge;
      syntheticIncome.push({
        id: `sp_${person.id}`,
        annualAmount,
        fromYear,
        owner: person.id,
      });
    }
  }

  // --- Build year array ---
  const years = Array.from({ length: totalYears }, (_, y) => {
    // Income items active this year (preserve employmentIncome flag for NI).
    const income = syntheticIncome
      .filter(item => y >= item.fromYear && (item.toYear == null || y < item.toYear))
      .map(item => ({
        id: item.id,
        amount: item.annualAmount,
        taxable: item.taxable || false,
        employmentIncome: item.employmentIncome || false,
        owner: item.owner,
      }));

    // Expense items active this year.
    const expense = expenseSchedule
      .filter(item => y >= item.fromYear && (item.toYear == null || y < item.toYear))
      .map(item => ({ id: item.id, amount: item.annualAmount }));

    // Property-level mortgage and BTL schedule resolution.
    const btlTaxableByBucket = {};
    let btlMortgageInterestTotal = 0;
    for (const pot of pots) {
      if (pot.type !== 'property') continue;
      const state = propertyState[pot.id];
      if (!state) continue;

      const resolved = resolvePropertyYear(pot, state);
      const bucket = getIncomeBucket(pot.owner);

      if (resolved.annualRent > 0) {
        income.push({
          id: `${pot.id}_rent`,
          amount: roundAmount(resolved.annualRent),
          taxable: false,
          employmentIncome: false,
          owner: pot.owner,
        });
      }
      if (resolved.annualOperatingExpenses > 0) {
        expense.push({ id: `${pot.id}_expenses`, amount: roundAmount(resolved.annualOperatingExpenses) });
      }
      if (resolved.annualMortgagePayment > 0) {
        // Mortgage payments are fixed nominal (not inflation-linked). The engine treats
        // all cashflow amounts as real (today's money) and scales by cumInflation, so we
        // deflate here to cancel that scaling and preserve the fixed nominal amount.
        const cumInfl = Math.pow(1 + simulationConfig.inflation.mean, y + 1);
        expense.push({ id: `${pot.id}_mortgage`, amount: Math.round(resolved.annualMortgagePayment / cumInfl) });
      }

      btlTaxableByBucket[bucket] = (btlTaxableByBucket[bucket] || 0) + resolved.taxableBtlIncome;
      btlMortgageInterestTotal += resolved.annualInterest;
    }

    // Capital events this year.
    const thisYearEvents = capitalEvents.filter(e => e.year === y);
    const capitalIn = thisYearEvents
      .filter(e => e.fromPot)
      .map(e => {
        const item = { id: e.id, fromPot: e.fromPot };
        if (e.haircut != null) item.haircut = e.haircut;
        else if (e.amount != null) item.amount = Math.abs(e.amount);
        return item;
      });
    const capitalOut = thisYearEvents
      .filter(e => !e.fromPot && e.toPot && e.toPot !== primaryPot)
      .map(e => ({ id: e.id, toPot: e.toPot, amount: Math.abs(e.amount) }));
    // Capital events with no toPot (or toPot = primaryPot) land as income.
    for (const e of thisYearEvents) {
      if (e.fromPot) continue;
      if (!e.toPot || e.toPot === primaryPot) {
        if (e.amount > 0) {
          let amount = e.amount;
          if (e.propertyPotId && propertyState[e.propertyPotId]) {
            const mortgagePayoff = propertyState[e.propertyPotId].outstandingBalance || 0;
            amount = Math.max(0, amount - mortgagePayoff);
            propertyState[e.propertyPotId].outstandingBalance = 0;
          }
          income.push({ id: e.id, amount, taxable: false });
        }
        if (e.amount < 0) expense.push({ id: e.id, amount: -e.amount });
      }
    }

    // --- Employer pension contributions ---
    // Computed per income line; routed as non-taxable income + capitalOut to pension pot.
    // Net effect on primary pot: zero. Pension pot grows by employer contribution amount.
    for (const item of syntheticIncome) {
      if (y < item.fromYear || (item.toYear != null && y >= item.toYear)) continue;
      const hasPct = item.employerPensionPct != null;
      const hasFixed = item.employerPensionAnnual != null;
      if (!hasPct && !hasFixed) continue;
      if (!item.employerPensionPotId) continue;
      if (!pots.find(p => p.id === item.employerPensionPotId)) continue;

      // Fixed amount wins over percentage if both present.
      const contrib = hasFixed
        ? item.employerPensionAnnual
        : item.annualAmount * item.employerPensionPct;
      if (contrib <= 0) continue;

      const contribRounded = Math.round(contrib);
      const contribId = `${item.id}_emp_pension`;
      // Non-taxable income arrives in primary pot, then immediately routed out.
      income.push({ id: contribId, amount: contribRounded, taxable: false, employmentIncome: false });
      capitalOut.push({ id: contribId, toPot: item.employerPensionPotId, amount: contribRounded });
    }

    // Surplus order: only include pot if its owner has not yet retired and pot is not property.
    // Pension pots get a 1.25 grossUpFactor (relief-at-source: HMRC tops up net contribution by 25%).
    const surplusOrder = surplusStrategy
      .filter(entry => {
        const pot = pots.find(p => p.id === entry.potId);
        if (!pot || pot.type === 'property') return false;
        // Exclude pension-type pots once their owner retires.
        const owner = potOwner[entry.potId];
        if (owner && y >= personRetirementYear[owner]) return false;
        return true;
      })
      .map(entry => {
        const pot = pots.find(p => p.id === entry.potId);
        const isPension = pot && entry.potId.includes('pension');
        return {
          potId: entry.potId,
          maxAmount: entry.annualCap,
          ...(isPension ? { grossUpFactor: 1.25 } : {}),
        };
      });

    // Draw order: only include pot if accessible this year and not property.
    const drawOrder = drawStrategy.filter(potId => {
      const pot = pots.find(p => p.id === potId);
      if (!pot || pot.type === 'property') return false;
      return y >= (potAccessYear[potId] || 0);
    });

    // --- Tax, NI, and employee pension relief ---
    const taxConfig = simulationConfig.tax;

    // Sum taxable and employment income by owner bucket.
    const taxableIncomeByBucket = {};
    const employmentIncomeByBucket = {};
    for (const inc of income) {
      const bucket = getIncomeBucket(inc.owner);
      if (inc.taxable) {
        taxableIncomeByBucket[bucket] = (taxableIncomeByBucket[bucket] || 0) + inc.amount;
      }
      if (inc.employmentIncome) {
        employmentIncomeByBucket[bucket] = (employmentIncomeByBucket[bucket] || 0) + inc.amount;
      }
    }

    // Add BTL taxable approximation by owner bucket.
    for (const [bucket, taxableAmount] of Object.entries(btlTaxableByBucket)) {
      taxableIncomeByBucket[bucket] = (taxableIncomeByBucket[bucket] || 0) + taxableAmount;
    }

    let yearTaxBeforeRelief = 0;
    let yearNI = 0;
    const marginalRateByBucket = {};
    let highestMarginalRate = 0;
    if (taxConfig) {
      for (const [bucket, taxableIncome] of Object.entries(taxableIncomeByBucket)) {
        const incomeForTax = Math.max(0, taxableIncome);
        yearTaxBeforeRelief += calculateUKTax(incomeForTax, taxConfig);
        const marginalRate = getMarginalRate(incomeForTax, taxConfig);
        marginalRateByBucket[bucket] = marginalRate;
        if (marginalRate > highestMarginalRate) highestMarginalRate = marginalRate;
      }
      for (const employmentIncome of Object.values(employmentIncomeByBucket)) {
        yearNI += calculateUKNI(Math.max(0, employmentIncome));
      }
    }

    // Estimate employee pension net contributions from surplus caps for pension pots.
    // Used to compute higher/additional-rate relief at planning time.
    const estimatedNetPensionContribByBucket = {};
    for (const entry of surplusOrder) {
      if (entry.potId.includes('pension')) {
        const bucket = getIncomeBucket(potOwner[entry.potId]);
        estimatedNetPensionContribByBucket[bucket] = (estimatedNetPensionContribByBucket[bucket] || 0) + entry.maxAmount;
      }
    }

    let additionalRelief = 0;
    for (const [bucket, netContrib] of Object.entries(estimatedNetPensionContribByBucket)) {
      const grossContrib = netContrib * 1.25;
      const marginalRate = bucket === '__household__'
        ? highestMarginalRate
        : (marginalRateByBucket[bucket] || 0);
      const extraReliefRate = Math.max(0, marginalRate - 0.20);
      additionalRelief += grossContrib * extraReliefRate;
    }
    additionalRelief = Math.round(additionalRelief);

    const btlMortgageInterestCredit = Math.round(btlMortgageInterestTotal * 0.20);
    const yearTax = Math.max(0, yearTaxBeforeRelief - additionalRelief - btlMortgageInterestCredit);

    const taxableIncome = Object.values(taxableIncomeByBucket).reduce((s, v) => s + v, 0);

    // Inject tax and NI as cashflow expenses (not debug-only).
    if (yearTax > 0) expense.push({ id: 'income_tax', amount: yearTax });
    if (yearNI > 0)  expense.push({ id: 'ni', amount: yearNI });

    const mortgageBalances = {};
    for (const [potId, state] of Object.entries(propertyState)) {
      if (state.outstandingBalance > 0) {
        mortgageBalances[potId] = state.outstandingBalance;
      }
    }

    return {
      income,
      expense,
      capitalOut,
      capitalIn,
      surplusOrder,
      drawOrder,
      tax: yearTax,
      ni: yearNI,
      btlMortgageInterestCredit,
      taxableIncome,
      mortgageBalances,
      warnings: [],
    };
  });

  // Build liabilities.byYear from the year-array mortgageBalances (deterministic, not behind debug flag).
  // Deflate nominal balances to real (today's money) using mean inflation.
  const inflationMean = simulationConfig.inflation.mean;
  const liabilitiesByYear = years.map((yr, idx) => {
    const cumInflation = Math.pow(1 + inflationMean, idx + 1);
    const realBalances = {};
    for (const [potId, balance] of Object.entries(yr.mortgageBalances || {})) {
      realBalances[potId] = Math.round(balance / cumInflation);
    }
    return { yearIndex: idx, mortgageBalances: realBalances };
  });

  // Build incomeStatementByYear: amounts in year array are already real (today's money) —
  // the engine treats them as real and scales by cumInflation internally.
  // Exception: mortgage payments were pre-divided by cumInflation before injection (they are
  // nominally fixed), so they arrive here already in real-equivalent terms too.
  // Tax/NI are computed on the real income amounts, so also effectively real.
  // No deflation needed — just restructure and strip income_tax/ni from expense.
  const incomeStatementByYear = years.map((yr, idx) => ({
    yearIndex: idx,
    income: (yr.income || []).map(item => ({ id: item.id, amount: Math.round(item.amount) })),
    tax: Math.round(yr.tax || 0),
    ni: Math.round(yr.ni || 0),
    expense: (yr.expense || [])
      .filter(item => item.id !== 'income_tax' && item.id !== 'ni')
      .map(item => ({ id: item.id, amount: Math.round(item.amount) })),
    capitalIn: (yr.capitalIn || []).map(item => ({ id: item.id, amount: Math.round(item.amount || 0) })),
    capitalOut: (yr.capitalOut || []).map(item => ({ id: item.id, amount: Math.round(item.amount || 0) })),
  }));

  // --- Detect taper warnings ---
  const { warnings: taperWarnings, warningYears } = detectTaperWarnings(years, surplusStrategy, pots, simulationConfig.tax || {});
  
  // Add per-year taper warning details
  for (const warnYear of warningYears) {
    if (years[warnYear]) {
      years[warnYear].warnings = years[warnYear].warnings || [];
      years[warnYear].warnings.push('Estimated pension contribution exceeds tapered allowance threshold');
    }
  }

  // --- Run engine ---
  const engineInput = { pots, primaryPot, retirementYear, years };
  const engineResult = simulate(engineInput, simulationConfig);

  // --- Decorate response with adapter-level metadata ---
  const refPerson = earliest;
  const statePensions = people
    .filter(p => p.statePension)
    .map(p => ({ name: p.name, annualAmount: p.statePension.annualAmount, fromAge: p.statePension.fromAge }));

  const response = {
    numSimulations:          engineResult.numSimulations,
    householdRetirementAge:  earliest.retirementAge,
    householdRetirementName: earliest.name,
    retirementYear:          retirementYear,
    warnings:                taperWarnings,
    accumulationSnapshot:    engineResult.accumulationSnapshot,
    statePensions,
    probabilityOfRuin:       engineResult.probabilityOfRuin,
    netWorthPercentiles:     engineResult.netWorthPercentiles || { byAge: [] },
    survivalTable:           engineResult.survivalTable.map(e => ({
      age: refPerson.currentAge + e.yearIndex + 1,
      yearIndex: e.yearIndex,
      probabilitySolvent: e.probabilitySolvent,
    })),
    portfolioPercentiles: {
      byAge: engineResult.portfolioPercentiles.byYear.map(e => ({
        age: refPerson.currentAge + e.yearIndex + 1,
        yearIndex: e.yearIndex,
        nominal: e.nominal,
        real: e.real,
      })),
    },
    potPercentiles: {
      byYear: engineResult.potPercentiles.byYear.map(e => ({
        age: refPerson.currentAge + e.yearIndex + 1,
        yearIndex: e.yearIndex,
        byPot: e.byPot,
      })),
    },
    liabilities: { byYear: liabilitiesByYear },
    incomeStatementByYear,
  };

  if (debug) {
    response.resolvedYears = years;
  }

  res.json(response);
});

router.__private = {
  calculateUKTax,
  calculateUKNI,
  getMarginalRate,
  resolvePropertyYear,
  getIncomeBucket,
};

module.exports = router;
