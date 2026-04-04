const { logNormalParams, sampleNormal, percentile } = require('./math');

function percentilesOf5(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

/**
 * Returns a 99-element array [p1, p2, ..., p99] from an unsorted values array.
 * Index i (0-based) = p(i+1).
 */
function allPercentiles(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const result = new Array(99);
  for (let p = 1; p <= 99; p++) {
    result[p - 1] = percentile(sorted, p);
  }
  return result;
}

/**
 * Single-pass Monte Carlo simulation covering both accumulation and drawdown.
 *
 * Each path runs from today to toAge in one continuous loop:
 *   - Accumulation phase: per-person pots grow with contributions + log-normal returns,
 *     using a shared inflation path
 *   - Household retirement triggers when the person with fewest years to retirement
 *     reaches their retirement age; all contributions stop at that point
 *   - Drawdown phase: income-target model with state pension offsets; income target,
 *     contributions, and capital events are supplied as pre-resolved dense arrays
 *
 * @param {object} input
 * @param {object[]} input.people
 * @param {number[][]} input.contributionByYear - [personIndex][year], annual amount in today's money
 * @param {number[]} input.incomeTargetByYear   - [year], annual household income target in today's money
 * @param {number[]} input.capitalEventsByYear  - [year], signed net capital event in today's money
 * @param {number} input.toAge
 *
 * Returns accumulation snapshot, drawdown stats, survival table, and p1–p99 fan chart
 * for every year from today to toAge. No raw paths are returned.
 */
function runFull(input, config) {
  const { people, contributionByYear, incomeTargetByYear, capitalEventsByYear, toAge } = input;
  const {
    numSimulations,
    annualReturnMean, annualReturnStdDev,
    annualInflationMean, annualInflationStdDev,
  } = config;

  const retParams = logNormalParams(annualReturnMean, annualReturnStdDev);
  const infParams = logNormalParams(annualInflationMean, annualInflationStdDev);

  // The person whose retirement age is nearest in time triggers household retirement.
  const earliest = people.reduce((best, p) =>
    (p.retirementAge - p.currentAge) < (best.retirementAge - best.currentAge) ? p : best
  );
  const householdRetirementYear = earliest.retirementAge - earliest.currentAge;
  const householdRetirementAge = earliest.retirementAge;
  const refCurrentAge = earliest.currentAge;

  const drawdownYears = toAge - householdRetirementAge;
  const totalYears = householdRetirementYear + drawdownYears;

  // Precompute the simulation year each state pension activates (per person's currentAge).
  const statePensions = people
    .filter(p => p.statePension)
    .map(p => ({
      name: p.name,
      annualAmount: p.statePension.annualAmount,
      fromAge: p.statePension.fromAge,
      activationYear: p.statePension.fromAge - p.currentAge,
    }));

  // Per-person accumulation setup — initial value only; contributions come from pre-resolved arrays.
  const personSetups = people.map(p => ({
    initialValue: p.accounts.reduce((s, a) => s + (a.currentValue || 0), 0),
  }));

  // Accumulate portfolio values at every year for fan chart (p1–p99).
  const valuesByYear = Array.from({ length: totalYears }, () => []);
  const realValuesByYear = Array.from({ length: totalYears }, () => []);

  // Retirement pot per simulation (for accumulation snapshot).
  const retirementPots = new Array(numSimulations);
  const retirementRealPots = new Array(numSimulations);

  let ruinCount = 0;
  const solventAtYear = new Array(drawdownYears).fill(0);
  const annualIncomes = new Array(numSimulations);

  for (let i = 0; i < numSimulations; i++) {
    const pots = personSetups.map(p => p.initialValue);
    let cumInflation = 1;

    // --- Accumulation phase ---
    for (let y = 0; y < householdRetirementYear; y++) {
      const inflFactor = Math.exp(infParams.muLn + infParams.sigmaLn * sampleNormal());
      cumInflation *= inflFactor;

      for (let pi = 0; pi < personSetups.length; pi++) {
        pots[pi] += contributionByYear[pi][y] * cumInflation;
        pots[pi] *= Math.exp(retParams.muLn + retParams.sigmaLn * sampleNormal());
      }

      // Apply household capital event (after contributions, before snapshot)
      const capEvent = capitalEventsByYear[y] || 0;
      if (capEvent !== 0) {
        // Distribute proportionally across pots; simplest: add to first person's pot
        pots[0] += capEvent;
        if (pots[0] < 0) pots[0] = 0; // floor at zero
      }

      valuesByYear[y].push(pots.reduce((s, v) => s + v, 0));
      realValuesByYear[y].push(pots.reduce((s, v) => s + v, 0) / cumInflation);
    }

    // Combined household pot at retirement.
    let pot = pots.reduce((s, v) => s + v, 0);
    retirementPots[i] = pot;
    retirementRealPots[i] = pot / cumInflation;

    // Income in today's money: incomeTargetByYear at retirement year, in today's money.
    annualIncomes[i] = incomeTargetByYear[householdRetirementYear];

    // --- Drawdown phase ---
    let ruined = false;
    for (let y = householdRetirementYear; y < totalYears; y++) {
      const inflFactor = Math.exp(infParams.muLn + infParams.sigmaLn * sampleNormal());
      cumInflation *= inflFactor;

      // Income target for this year, inflated from today's money.
      const inflatedTarget = incomeTargetByYear[y] * cumInflation;

      // Sum all active state pensions, inflated from today's money.
      let totalSP = 0;
      for (const sp of statePensions) {
        if (y >= sp.activationYear) {
          totalSP += sp.annualAmount * cumInflation;
        }
      }

      const draw = Math.max(0, inflatedTarget - totalSP);

      if (draw > pot) {
        ruined = true;
        ruinCount++;
        break;
      }

      pot -= draw;

      // Apply capital event (net signed) before return factor
      const capEvent = capitalEventsByYear[y] || 0;
      if (capEvent !== 0) {
        pot += capEvent;
        if (pot < 0) pot = 0;
      }

      pot *= Math.exp(retParams.muLn + retParams.sigmaLn * sampleNormal());

      const ddY = y - householdRetirementYear;
      solventAtYear[ddY]++;
      valuesByYear[y].push(pot);
      realValuesByYear[y].push(pot / cumInflation);
    }
  }

  // Accumulation snapshot (p10/p25/p50/p75/p90 at retirement).
  const accumulationSnapshot = {
    yearsToRetirement: householdRetirementYear,
    nominal: percentilesOf5(retirementPots),
    real: percentilesOf5(retirementRealPots),
  };

  // Fan chart: p1–p99 for every year (nominal and real).
  const byAge = [];
  for (let y = 0; y < totalYears; y++) {
    if (valuesByYear[y].length > 0) {
      byAge.push({
        age: refCurrentAge + y + 1,
        nominal: allPercentiles(valuesByYear[y]),
        real: allPercentiles(realValuesByYear[y]),
      });
    }
  }

  // Survival table — one entry per drawdown year (annual).
  const survivalTable = [];
  for (let y = 0; y < drawdownYears; y++) {
    survivalTable.push({
      age: householdRetirementAge + y + 1,
      probabilitySolvent: parseFloat((solventAtYear[y] / numSimulations).toFixed(4)),
    });
  }

  const sortedIncomes = annualIncomes.slice().sort((a, b) => a - b);
  const annualIncomeTargetAtRetirement = incomeTargetByYear[householdRetirementYear];
  const realP50AtRetirement = percentilesOf5(retirementRealPots).p50;

  return {
    numSimulations,
    householdRetirementAge,
    householdRetirementName: earliest.name,
    accumulationSnapshot,
    annualIncomeTarget: annualIncomeTargetAtRetirement,
    withdrawalRate: realP50AtRetirement > 0
      ? parseFloat((annualIncomeTargetAtRetirement / realP50AtRetirement).toFixed(4))
      : 0,
    annualIncomeMedian: Math.round(sortedIncomes[Math.floor(numSimulations / 2)]),
    annualIncomeP10: Math.round(sortedIncomes[Math.floor(numSimulations * 0.1)]),
    annualIncomeP90: Math.round(sortedIncomes[Math.floor(numSimulations * 0.9)]),
    statePensions: statePensions.map(({ name, annualAmount, fromAge }) => ({ name, annualAmount, fromAge })),
    probabilityOfRuin: parseFloat((ruinCount / numSimulations).toFixed(4)),
    survivalTable,
    portfolioPercentiles: { byAge },
  };
}

module.exports = { runFull };
