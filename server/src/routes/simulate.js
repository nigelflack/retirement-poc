const express = require('express');
const router = express.Router();
const { runFull } = require('../simulation/run');
const simulationConfig = require('../../config/simulation.json');

/**
 * Resolves sparse schedule inputs into dense per-year arrays for the engine.
 *
 * Called once per request before runFull. The engine only ever sees flat arrays.
 *
 * @param {object} input - validated request body
 * @param {number} totalYears - total simulation years (accumulation + drawdown)
 * @param {number} householdRetirementYear - year index when household retires
 * @param {number[]} retirementYears - per-person retirement year indices (same order as people)
 * @returns {{ contributionByYear: number[][], incomeTargetByYear: number[], capitalEventsByYear: number[] }}
 */
function resolveSchedules(input, totalYears, householdRetirementYear, retirementYears) {
  const { people, monthlyIncomeTarget, incomeSchedule, capitalEvents } = input;
  const annualIncomeTarget = monthlyIncomeTarget * 12;

  // --- contributionByYear: one array per person ---
  const contributionByYear = people.map((person, pi) => {
    const yearlyContribution = new Array(totalYears).fill(0);
    const schedule = person.contributionSchedule;
    const personRetirementYear = retirementYears[pi];

    if (schedule && schedule.length > 0) {
      // Sort schedule ascending by fromYearsFromToday
      const sorted = schedule.slice().sort((a, b) => a.fromYearsFromToday - b.fromYearsFromToday);
      let si = sorted.length - 1; // start from last step
      for (let y = 0; y < personRetirementYear; y++) {
        // Find the applicable step: the last one with fromYearsFromToday <= y
        while (si > 0 && sorted[si].fromYearsFromToday > y) si--;
        // find the correct segment
        let amount = 0;
        for (let k = sorted.length - 1; k >= 0; k--) {
          if (sorted[k].fromYearsFromToday <= y) {
            amount = sorted[k].monthlyAmount * 12;
            break;
          }
        }
        yearlyContribution[y] = amount;
      }
      // years from personRetirementYear onward remain 0
    } else {
      // Default: flat contribution from accounts until this person retires
      const flat = person.accounts.reduce((s, a) => s + (a.monthlyContribution || 0), 0) * 12;
      for (let y = 0; y < personRetirementYear; y++) {
        yearlyContribution[y] = flat;
      }
    }

    return yearlyContribution;
  });

  // --- incomeTargetByYear: household level ---
  const incomeTargetByYear = new Array(totalYears).fill(0);
  const schedule = incomeSchedule && incomeSchedule.length > 0 ? incomeSchedule : null;

  for (let y = householdRetirementYear; y < totalYears; y++) {
    if (schedule) {
      // Find the last step with fromYearsFromRetirement <= (y - householdRetirementYear)
      const yearsIntoRetirement = y - householdRetirementYear;
      let amount = 0;
      for (let k = schedule.length - 1; k >= 0; k--) {
        if (schedule[k].fromYearsFromRetirement <= yearsIntoRetirement) {
          amount = schedule[k].monthlyAmount * 12;
          break;
        }
      }
      incomeTargetByYear[y] = amount;
    } else {
      incomeTargetByYear[y] = annualIncomeTarget;
    }
  }

  // --- capitalEventsByYear: household level ---
  const capitalEventsByYear = new Array(totalYears).fill(0);
  if (capitalEvents) {
    for (const event of capitalEvents) {
      if (event.yearsFromToday >= 0 && event.yearsFromToday < totalYears) {
        capitalEventsByYear[event.yearsFromToday] += event.amount;
      }
    }
  }

  return { contributionByYear, incomeTargetByYear, capitalEventsByYear };
}

function validatePeople(people) {
  if (!Array.isArray(people) || people.length === 0) {
    return 'people must be a non-empty array';
  }
  for (const person of people) {
    if (!person.name || person.currentAge == null || person.retirementAge == null || !Array.isArray(person.accounts)) {
      return 'Each person must have name, currentAge, retirementAge, and accounts array';
    }
    if (typeof person.currentAge !== 'number' || typeof person.retirementAge !== 'number') {
      return 'currentAge and retirementAge must be numbers';
    }
    if (person.retirementAge <= person.currentAge) {
      return `retirementAge must be greater than currentAge for ${person.name}`;
    }
  }
  return null;
}

router.post('/', (req, res) => {
  const {
    people,
    monthlyIncomeTarget,
    incomeSchedule,
    capitalEvents,
    toAge = 100,
    debug = false,
  } = req.body;

  const peopleErr = validatePeople(people);
  if (peopleErr) return res.status(400).json({ error: peopleErr });

  if (typeof monthlyIncomeTarget !== 'number' || monthlyIncomeTarget <= 0) {
    return res.status(400).json({ error: 'monthlyIncomeTarget must be a positive number' });
  }
  if (typeof toAge !== 'number' || toAge <= 0) {
    return res.status(400).json({ error: 'toAge must be a positive number' });
  }

  // Compute totalYears and retirement year indices (mirrors engine logic)
  const earliest = people.reduce((best, p) =>
    (p.retirementAge - p.currentAge) < (best.retirementAge - best.currentAge) ? p : best
  );
  const householdRetirementYear = earliest.retirementAge - earliest.currentAge;
  const drawdownYears = toAge - earliest.retirementAge;
  const totalYears = householdRetirementYear + drawdownYears;

  const retirementYears = people.map(p => p.retirementAge - p.currentAge);

  const resolved = resolveSchedules(
    { people, monthlyIncomeTarget, incomeSchedule, capitalEvents },
    totalYears,
    householdRetirementYear,
    retirementYears,
  );

  const results = runFull({ people, toAge, ...resolved }, simulationConfig);

  if (debug) {
    results.resolvedSchedules = resolved;
  }

  res.json(results);
});

module.exports = router;
