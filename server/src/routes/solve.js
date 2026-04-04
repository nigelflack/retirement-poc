const express = require('express');
const router = express.Router();
const { runFull } = require('../simulation/run');
const { interpolateSolventAt } = require('../simulation/math');
const config = require('../../config/simulation.json');

// Use a reduced simulation count for search iterations — SE ≈ 0.8% at p=0.85,
// well within the 2% default tolerance. POST /simulate still uses the full config.
const SOLVE_SEARCH_CONFIG = { ...config, numSimulations: 2000 };

/**
 * Build the flat dense arrays required by runFull for a simple flat-schedule run.
 * Solve endpoints do not support contribution/income schedules or capital events.
 */
function buildFlatInput(people, annualIncomeTarget, toAge) {
  const earliest = people.reduce((best, p) =>
    (p.retirementAge - p.currentAge) < (best.retirementAge - best.currentAge) ? p : best
  );
  const householdRetirementYear = earliest.retirementAge - earliest.currentAge;
  const drawdownYears = toAge - earliest.retirementAge;
  const totalYears = householdRetirementYear + drawdownYears;

  const contributionByYear = people.map(p => {
    const flat = p.accounts.reduce((s, a) => s + (a.monthlyContribution || 0), 0) * 12;
    const personRetirementYear = p.retirementAge - p.currentAge;
    return Array.from({ length: totalYears }, (_, y) => (y < personRetirementYear ? flat : 0));
  });

  const incomeTargetByYear = Array.from({ length: totalYears }, (_, y) =>
    y >= householdRetirementYear ? annualIncomeTarget : 0
  );

  const capitalEventsByYear = new Array(totalYears).fill(0);

  return { people, contributionByYear, incomeTargetByYear, capitalEventsByYear, toAge };
}

function validatePeople(people) {
  if (!Array.isArray(people) || people.length === 0) {
    return 'people is required and must be a non-empty array';
  }
  for (const p of people) {
    if (!p.name || p.currentAge == null || p.retirementAge == null || !Array.isArray(p.accounts)) {
      return 'Each person must have name, currentAge, retirementAge, and accounts array';
    }
    if (typeof p.currentAge !== 'number' || typeof p.retirementAge !== 'number') {
      return 'currentAge and retirementAge must be numbers';
    }
    if (p.retirementAge <= p.currentAge) {
      return `retirementAge must be greater than currentAge for ${p.name}`;
    }
  }
  return null;
}

function validateSolveParams(targetSolvencyPct, referenceAge) {
  if (typeof targetSolvencyPct !== 'number' || targetSolvencyPct <= 0 || targetSolvencyPct >= 1) {
    return 'targetSolvencyPct must be between 0 and 1 exclusive';
  }
  if (!Number.isInteger(referenceAge) || referenceAge <= 0) {
    return 'referenceAge must be a positive integer';
  }
  return null;
}

// POST /solve/income — binary search for the maximum sustainable monthly income
router.post('/income', (req, res) => {
  const { people, toAge = 100, targetSolvencyPct = 0.85, referenceAge = 90, tolerance = 0.02 } = req.body;

  const peopleErr = validatePeople(people);
  if (peopleErr) return res.status(400).json({ error: peopleErr });

  const paramErr = validateSolveParams(targetSolvencyPct, referenceAge);
  if (paramErr) return res.status(400).json({ error: paramErr });

  if (typeof tolerance !== 'number' || tolerance <= 0 || tolerance >= 1) {
    return res.status(400).json({ error: 'tolerance must be between 0 and 1 exclusive' });
  }

  // Seed run to get p50 of real accumulation — needed to bound the income search.
  const seedInput = buildFlatInput(people, 1, toAge); // income=1 just to get accumulation snapshot
  const seed = runFull(seedInput, SOLVE_SEARCH_CONFIG);
  const p50 = seed.accumulationSnapshot.real.p50;

  let lo = 0;
  let hi = p50 / 12; // ceiling: 100% annual withdrawal expressed as monthly
  let bestIncome = 0;
  let bestSolvency = 0;

  for (let iter = 0; iter < 50; iter++) {
    const mid = (lo + hi) / 2;
    const annualIncomeTarget = mid * 12;
    const result = runFull(buildFlatInput(people, annualIncomeTarget, toAge), SOLVE_SEARCH_CONFIG);
    const solvency = interpolateSolventAt(result.survivalTable, referenceAge);

    if (solvency >= targetSolvencyPct) {
      lo = mid;
      bestIncome = mid;
      bestSolvency = solvency;
      if (Math.abs(solvency - targetSolvencyPct) <= tolerance) break;
    } else {
      hi = mid;
    }
  }

  if (bestIncome === 0) {
    return res.status(422).json({ error: 'Could not find a sustainable income within the simulation bounds' });
  }

  res.json({
    monthlyIncome: Math.round(bestIncome),
    survivalAtReferenceAge: parseFloat(bestSolvency.toFixed(4)),
  });
});

// POST /solve/ages — binary search for the earliest retirement ages that achieve the income target
router.post('/ages', (req, res) => {
  const { people, monthlyIncome, toAge = 100, targetSolvencyPct = 0.85, referenceAge = 90 } = req.body;

  const peopleErr = validatePeople(people);
  if (peopleErr) return res.status(400).json({ error: peopleErr });

  if (typeof monthlyIncome !== 'number' || monthlyIncome <= 0) {
    return res.status(400).json({ error: 'monthlyIncome must be a positive number' });
  }

  const paramErr = validateSolveParams(targetSolvencyPct, referenceAge);
  if (paramErr) return res.status(400).json({ error: paramErr });

  // Binary search over an offset window of [0, 20] years added to each person's floor retirementAge.
  let lo = 0;
  let hi = 20;
  let bestOffset = null;
  let bestSolvency = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const currentPeople = people.map(p => ({ ...p, retirementAge: p.retirementAge + mid }));

    // Guard: skip if any person's retirement age is at or beyond toAge.
    if (currentPeople.some(p => p.retirementAge >= toAge)) {
      hi = mid - 1;
      continue;
    }

    const annualIncomeTarget = monthlyIncome * 12;
    const result = runFull(buildFlatInput(currentPeople, annualIncomeTarget, toAge), SOLVE_SEARCH_CONFIG);
    const solvency = interpolateSolventAt(result.survivalTable, referenceAge);

    if (solvency >= targetSolvencyPct) {
      bestOffset = mid;
      bestSolvency = solvency;
      hi = mid - 1; // try retiring earlier
    } else {
      lo = mid + 1; // need to work longer
    }
  }

  if (bestOffset === null) {
    return res.status(422).json({ error: 'Could not find retirement ages that satisfy the solvency target' });
  }

  const solvedPeople = people.map(p => ({ ...p, retirementAge: p.retirementAge + bestOffset }));

  res.json({
    retirementAges: solvedPeople.map(p => ({ name: p.name, retirementAge: p.retirementAge })),
    monthlyIncome,
    survivalAtReferenceAge: parseFloat(bestSolvency.toFixed(4)),
  });
});

module.exports = router;
