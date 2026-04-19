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
 * Calculate UK-style income tax for a given taxable income.
 * Applies progressive tax bands and personal allowance taper.
 */
function calculateUKTax(income, taxConfig) {
  const { bands, personalAllowanceTaper } = taxConfig;
  
  // Determine allowance after taper
  let allowance = bands[0] ? (bands[1]?.floor || 12570) : 12570;
  if (personalAllowanceTaper && income > personalAllowanceTaper.incomeThreshold) {
    const excessIncome = income - personalAllowanceTaper.incomeThreshold;
    const allowanceLoss = excessIncome * personalAllowanceTaper.taperRate;
    allowance = Math.max(0, allowance - allowanceLoss);
  }
  
  const taxableIncome = Math.max(0, income - allowance);
  if (taxableIncome <= 0) return 0;
  
  // Apply progressive tax bands
  let tax = 0;
  for (let i = bands.length - 1; i >= 1; i--) {
    const band = bands[i];
    const nextBandFloor = i < bands.length - 1 ? bands[i + 1].floor : Infinity;
    
    if (taxableIncome > band.floor) {
      const upper = Math.min(taxableIncome, nextBandFloor);
      const taxableInBand = upper - band.floor;
      tax += taxableInBand * band.rate;
    }
  }
  
  return Math.round(tax);
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
        grossIncome += inc.amount;
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
    if (!['investments', 'property', 'cash'].includes(pot.type)) {
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
      });
    }
  }

  // --- Build year array ---
  const years = Array.from({ length: totalYears }, (_, y) => {
    // Income items active this year.
    const income = syntheticIncome
      .filter(item => y >= item.fromYear && (item.toYear == null || y < item.toYear))
      .map(item => ({ id: item.id, amount: item.annualAmount, taxable: item.taxable || false }));

    // Expense items active this year.
    const expense = expenseSchedule
      .filter(item => y >= item.fromYear && (item.toYear == null || y < item.toYear))
      .map(item => ({ id: item.id, amount: item.annualAmount }));

    // Capital events this year.
    const thisYearEvents = capitalEvents.filter(e => e.year === y);
    const capitalOut = thisYearEvents
      .filter(e => e.toPot && e.toPot !== primaryPot)
      .map(e => ({ id: e.id, toPot: e.toPot, amount: Math.abs(e.amount) }));
    // Capital events with no toPot (or toPot = primaryPot) land as income.
    for (const e of thisYearEvents) {
      if (!e.toPot || e.toPot === primaryPot) {
        if (e.amount > 0)  income.push({ id: e.id, amount:  e.amount, taxable: false });
        if (e.amount < 0) expense.push({ id: e.id, amount: -e.amount });
      }
    }

    // Surplus order: only include pot if its owner has not yet retired and pot is not property.
    const surplusOrder = surplusStrategy
      .filter(entry => {
        const pot = pots.find(p => p.id === entry.potId);
        if (!pot || pot.type === 'property') return false;
        // Exclude pension-type pots once their owner retires.
        const owner = potOwner[entry.potId];
        if (owner && y >= personRetirementYear[owner]) return false;
        return true;
      })
      .map(entry => ({ potId: entry.potId, maxAmount: entry.annualCap }));

    // Draw order: only include pot if accessible this year and not property.
    const drawOrder = drawStrategy.filter(potId => {
      const pot = pots.find(p => p.id === potId);
      if (!pot || pot.type === 'property') return false;
      return y >= (potAccessYear[potId] || 0);
    });

    // Calculate tax for this year (taxable income only)
    let taxableIncome = 0;
    for (const inc of income) {
      if (inc.taxable) taxableIncome += inc.amount;
    }
    
    const yearTax = simulationConfig.tax 
      ? calculateUKTax(taxableIncome, simulationConfig.tax)
      : 0;

    return {
      income,
      expense,
      capitalOut,
      capitalIn: [],
      surplusOrder,
      drawOrder,
      tax: yearTax,
      warnings: [],
    };
  });

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
  };

  if (debug) {
    response.resolvedYears = years;
  }

  res.json(response);
});

module.exports = router;
