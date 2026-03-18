const { logNormalParams, sampleNormal, percentilesOf } = require('./monteCarlo');

/**
 * Drawdown simulation — continues each accumulation path through retirement.
 *
 * For each path i:
 *   - Starting pot is paths[i] (nominal value at retirement from Stage 1)
 *   - Annual withdrawal is fixed at paths[i] * withdrawalRate (classic 4% rule)
 *   - That amount is inflated each year by the simulated inflation factor
 *   - Returns are applied after withdrawal
 *   - Ruin = first year pot <= 0 (first-hit)
 *
 * Returns probability of ruin, survival table, annual income stats, and
 * portfolio percentiles by age for fan chart rendering.
 */
function runDrawdown(input, config) {
  const { paths, realPaths, withdrawalRate, retirementAge, toAge } = input;
  const {
    annualReturnMean, annualReturnStdDev,
    annualInflationMean, annualInflationStdDev,
  } = config;

  const numSimulations = paths.length;
  const drawdownYears = toAge - retirementAge;

  const retParams = logNormalParams(annualReturnMean, annualReturnStdDev);
  const infParams = logNormalParams(annualInflationMean, annualInflationStdDev);

  let ruinCount = 0;
  // Track how many paths are still solvent at each year end.
  const solventAtYear = new Array(drawdownYears).fill(0);
  // Track portfolio values by year for percentile fan chart (only solvent paths).
  const valuesByYear = Array.from({ length: drawdownYears }, () => []);
  // Annual income per path (in today's money = nominal at retirement).
  const annualIncomes = new Array(numSimulations);

  for (let i = 0; i < numSimulations; i++) {
    const startingPot = paths[i];
    const annualWithdrawal = startingPot * withdrawalRate;
    // Express income in today's money using the real (inflation-deflated) pot.
    annualIncomes[i] = (realPaths ? realPaths[i] : startingPot) * withdrawalRate;

    let pot = startingPot;
    let ruined = false;
    let inflatedWithdrawal = annualWithdrawal;

    for (let y = 0; y < drawdownYears; y++) {
      const inflFactor = Math.exp(infParams.muLn + infParams.sigmaLn * sampleNormal());
      inflatedWithdrawal *= inflFactor;

      pot -= inflatedWithdrawal;

      if (pot <= 0) {
        ruined = true;
        ruinCount++;
        break;
      }

      pot *= Math.exp(retParams.muLn + retParams.sigmaLn * sampleNormal());
      solventAtYear[y]++;
      valuesByYear[y].push(pot);
    }

    if (!ruined) {
      // Already counted in the loop above for all years.
    }
  }

  // Build survival table at 5-year intervals.
  const survivalTable = [];
  for (let y = 4; y < drawdownYears; y += 5) {
    survivalTable.push({
      age: retirementAge + y + 1,
      probabilitySolvent: parseFloat((solventAtYear[y] / numSimulations).toFixed(4)),
    });
  }
  // Always include toAge.
  if ((drawdownYears - 1) % 5 !== 4) {
    survivalTable.push({
      age: toAge,
      probabilitySolvent: parseFloat((solventAtYear[drawdownYears - 1] / numSimulations).toFixed(4)),
    });
  }

  // Portfolio percentiles by age (p10/p50/p90 of solvent paths only).
  const byAge = [];
  for (let y = 0; y < drawdownYears; y++) {
    if (valuesByYear[y].length > 0) {
      const p = percentilesOf(valuesByYear[y]);
      byAge.push({
        age: retirementAge + y + 1,
        nominal: { p10: p.p10, p50: p.p50, p90: p.p90 },
      });
    }
  }

  const sortedIncomes = annualIncomes.slice().sort((a, b) => a - b);

  return {
    numSimulations,
    withdrawalRate,
    annualIncomeMedian: Math.round(sortedIncomes[Math.floor(numSimulations / 2)]),
    annualIncomeP10: Math.round(sortedIncomes[Math.floor(numSimulations * 0.1)]),
    annualIncomeP90: Math.round(sortedIncomes[Math.floor(numSimulations * 0.9)]),
    probabilityOfRuin: parseFloat((ruinCount / numSimulations).toFixed(4)),
    survivalTable,
    portfolioPercentiles: { byAge },
  };
}

module.exports = { runDrawdown };
