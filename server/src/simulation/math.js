/**
 * Pure math utilities for the Monte Carlo simulation.
 */

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

/**
 * Linear interpolation of probabilitySolvent at any age from a survival table
 * whose entries are at 5-year intervals. Returns null if the table is empty.
 */
function interpolateSolventAt(survivalTable, targetAge) {
  if (!survivalTable || survivalTable.length === 0) return null;
  const exact = survivalTable.find(e => e.age === targetAge);
  if (exact) return exact.probabilitySolvent;
  const loEntries = survivalTable.filter(e => e.age < targetAge);
  const hiEntries = survivalTable.filter(e => e.age > targetAge);
  const lo = loEntries[loEntries.length - 1];
  const hi = hiEntries[0];
  if (!lo) return hi.probabilitySolvent;
  if (!hi) return lo.probabilitySolvent;
  const frac = (targetAge - lo.age) / (hi.age - lo.age);
  return lo.probabilitySolvent + frac * (hi.probabilitySolvent - lo.probabilitySolvent);
}

module.exports = { sampleNormal, logNormalParams, percentile, interpolateSolventAt };
