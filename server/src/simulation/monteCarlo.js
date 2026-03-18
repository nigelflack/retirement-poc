/**
 * Box-Muller transform — samples one value from N(0, 1).
 */
function sampleNormal() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Derives log-normal parameters (μ_ln, σ_ln) from the desired arithmetic
 * mean and standard deviation of the annual return factor (1 + r).
 *
 *   σ_ln² = ln(1 + (σ / (1 + μ))²)
 *   μ_ln  = ln(1 + μ) − σ_ln² / 2
 */
function logNormalParams(mean, stdDev) {
  const sigmaLn2 = Math.log(1 + Math.pow(stdDev / (1 + mean), 2));
  const sigmaLn = Math.sqrt(sigmaLn2);
  const muLn = Math.log(1 + mean) - sigmaLn2 / 2;
  return { muLn, sigmaLn };
}

/**
 * Linear interpolation percentile from a sorted array.
 */
function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return Math.round(sorted[lo]);
  const frac = idx - lo;
  return Math.round(sorted[lo] * (1 - frac) + sorted[hi] * frac);
}

function percentilesOf(arr) {
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
 * Runs Monte Carlo simulations for multiple people.
 *
 * Each simulation year:
 *   1. Annual contributions are added to each person's portfolio.
 *   2. A log-normal return is sampled independently per person.
 *   3. A shared log-normal inflation factor is sampled and applied to a
 *      cumulative deflator (same macro environment for all people).
 *
 * Household snapshot is taken at the earliest retirement year across all
 * people. Individual results are taken at each person's own retirement year.
 *
 * Returns per-person nominal/real percentiles and household nominal/real
 * percentiles.
 */
function runSimulation(people, config) {
  const {
    numSimulations,
    annualReturnMean, annualReturnStdDev,
    annualInflationMean, annualInflationStdDev,
  } = config;

  const retParams = logNormalParams(annualReturnMean, annualReturnStdDev);
  const infParams = logNormalParams(annualInflationMean, annualInflationStdDev);

  const householdYears = Math.min(...people.map(p => p.yearsToRetirement));
  const maxYears = Math.max(...people.map(p => p.yearsToRetirement));

  const personNomFinals = people.map(() => new Array(numSimulations));
  const personRealFinals = people.map(() => new Array(numSimulations));
  const householdNomFinals = new Array(numSimulations);
  const householdRealFinals = new Array(numSimulations);

  for (let i = 0; i < numSimulations; i++) {
    // Generate a shared inflation path for the full simulation horizon.
    const inflFactors = new Array(maxYears);
    for (let y = 0; y < maxYears; y++) {
      inflFactors[y] = Math.exp(infParams.muLn + infParams.sigmaLn * sampleNormal());
    }

    // Cumulative inflation to the household snapshot year.
    let householdCumInfl = 1;
    for (let y = 0; y < householdYears; y++) householdCumInfl *= inflFactors[y];

    let householdNomSum = 0;

    for (let pi = 0; pi < people.length; pi++) {
      const { initialValue, annualContribution, yearsToRetirement } = people[pi];
      let value = initialValue;
      let cumInfl = 1;

      for (let y = 0; y < yearsToRetirement; y++) {
        value += annualContribution;
        value *= Math.exp(retParams.muLn + retParams.sigmaLn * sampleNormal());
        cumInfl *= inflFactors[y];

        if (y + 1 === householdYears) {
          householdNomSum += value;
        }
      }

      personNomFinals[pi][i] = value;
      personRealFinals[pi][i] = value / cumInfl;
    }

    householdNomFinals[i] = householdNomSum;
    householdRealFinals[i] = householdNomSum / householdCumInfl;
  }

  return {
    people: people.map((p, pi) => ({
      name: p.name,
      yearsToRetirement: p.yearsToRetirement,
      nominal: percentilesOf(personNomFinals[pi]),
      real: percentilesOf(personRealFinals[pi]),
    })),
    household: {
      yearsToSnapshot: householdYears,
      nominal: percentilesOf(householdNomFinals),
      real: percentilesOf(householdRealFinals),
    },
  };
}

module.exports = { runSimulation };
