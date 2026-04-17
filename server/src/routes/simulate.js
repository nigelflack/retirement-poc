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
 *   incomeSchedule[]  — { id, annualAmount, fromYear, toYear? }
 *   expenseSchedule[] — { id, annualAmount, fromYear, toYear? }
 *   capitalEvents[]   — { id, year, amount, toPot? }
 *   surplusStrategy[] — { potId, annualCap }
 *   drawStrategy[]    — [potId, ...]  (ordered draw priority)
 *   toAge             — simulation horizon age (default 100)
 *   debug             — if true, include resolvedYears in response
 */
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
      .map(item => ({ id: item.id, amount: item.annualAmount }));

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
        if (e.amount > 0)  income.push({ id: e.id, amount:  e.amount });
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

    return {
      income,
      expense,
      capitalOut,
      capitalIn: [],
      surplusOrder,
      drawOrder,
    };
  });

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
    accumulationSnapshot:    engineResult.accumulationSnapshot,
    statePensions,
    probabilityOfRuin:       engineResult.probabilityOfRuin,
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
