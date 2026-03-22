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
 *   - Drawdown phase: classic income-target model with state pension offsets (v0.4)
 *
 * Returns accumulation snapshot, drawdown stats, survival table, and p1–p99 fan chart
 * for every year from today to toAge. No raw paths are returned.
 */
function runFull(input, config) {
  const { people, withdrawalRate, toAge } = input;
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

  // Per-person accumulation setup.
  const personSetups = people.map(p => ({
    initialValue: p.accounts.reduce((s, a) => s + (a.currentValue || 0), 0),
    annualContribution: p.accounts.reduce((s, a) => s + (a.monthlyContribution || 0), 0) * 12,
  }));

  // Accumulate portfolio values at every year for fan chart (p1–p99).
  const valuesByYear = Array.from({ length: totalYears }, () => []);

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
        pots[pi] += personSetups[pi].annualContribution;
        pots[pi] *= Math.exp(retParams.muLn + retParams.sigmaLn * sampleNormal());
      }

      valuesByYear[y].push(pots.reduce((s, v) => s + v, 0));
    }

    // Combined household pot at retirement.
    let pot = pots.reduce((s, v) => s + v, 0);
    retirementPots[i] = pot;
    retirementRealPots[i] = pot / cumInflation;

    // Income in today's money = real pot × rate.
    annualIncomes[i] = (pot / cumInflation) * withdrawalRate;

    let inflatedTarget = pot * withdrawalRate;

    // --- Drawdown phase ---
    let ruined = false;
    for (let y = householdRetirementYear; y < totalYears; y++) {
      const inflFactor = Math.exp(infParams.muLn + infParams.sigmaLn * sampleNormal());
      cumInflation *= inflFactor;
      inflatedTarget *= inflFactor;

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
      pot *= Math.exp(retParams.muLn + retParams.sigmaLn * sampleNormal());

      const ddY = y - householdRetirementYear;
      solventAtYear[ddY]++;
      valuesByYear[y].push(pot);
    }
  }

  // Accumulation snapshot (p10/p25/p50/p75/p90 at retirement).
  const accumulationSnapshot = {
    yearsToRetirement: householdRetirementYear,
    nominal: percentilesOf5(retirementPots),
    real: percentilesOf5(retirementRealPots),
  };

  // Fan chart: p1–p99 for every year.
  const byAge = [];
  for (let y = 0; y < totalYears; y++) {
    if (valuesByYear[y].length > 0) {
      byAge.push({
        age: refCurrentAge + y + 1,
        nominal: allPercentiles(valuesByYear[y]),
      });
    }
  }

  // Survival table at 5-year intervals through drawdown.
  const survivalTable = [];
  for (let y = 4; y < drawdownYears; y += 5) {
    survivalTable.push({
      age: householdRetirementAge + y + 1,
      probabilitySolvent: parseFloat((solventAtYear[y] / numSimulations).toFixed(4)),
    });
  }
  if ((drawdownYears - 1) % 5 !== 4) {
    survivalTable.push({
      age: toAge,
      probabilitySolvent: parseFloat((solventAtYear[drawdownYears - 1] / numSimulations).toFixed(4)),
    });
  }

  const sortedIncomes = annualIncomes.slice().sort((a, b) => a - b);

  return {
    numSimulations,
    householdRetirementAge,
    householdRetirementName: earliest.name,
    accumulationSnapshot,
    withdrawalRate,
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
