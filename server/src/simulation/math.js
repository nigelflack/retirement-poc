/**
 * Pure math utilities for the Monte Carlo simulation.
 */

/**
 * Box-Muller transform — samples one value from N(0, 1).
 */
function sampleStandardNormal() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Converts arithmetic mean and standard deviation of the annual return factor
 * (1 + r) into log-normal parameters (μ_ln, σ_ln).
 *
 *   σ_ln² = ln(1 + (σ / (1 + μ))²)
 *   μ_ln  = ln(1 + μ) − σ_ln² / 2
 */
function lognormalFromArithmetic(mean, stdDev) {
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
 * Returns the five summary percentiles (p10, p25, p50, p75, p90) of an array.
 */
function summaryPercentiles(arr) {
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
 * Returns all 99 percentiles (p1–p99) of an array.
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
 * Builds an opaque return model from simulation config.
 * Pass the result to sampleInflationFactor and sampleReturnFactor.
 */
function buildReturnModel(config) {
  const { inflation, returns: returnConfig } = config;
  const retParamsByType = {};
  for (const [type, params] of Object.entries(returnConfig)) {
    retParamsByType[type] = lognormalFromArithmetic(params.mean, params.stdDev);
  }
  const infParams = lognormalFromArithmetic(inflation.mean, inflation.stdDev);
  return { infParams, retParamsByType };
}

/**
 * Samples one inflation factor from the model.
 * @param {object}   model - from buildReturnModel
 * @param {number}   year  - simulation year (reserved for future CMA)
 * @param {function} rng   - () => N(0,1)
 */
function sampleInflationFactor(model, year, rng) {
  const { infParams } = model;
  return Math.exp(infParams.muLn + infParams.sigmaLn * rng());
}

/**
 * Samples one return factor for a given pot type.
 * @param {object}   model - from buildReturnModel
 * @param {string}   type  - pot type ('investments', 'property', 'cash')
 * @param {number}   year  - simulation year (reserved for future CMA)
 * @param {function} rng   - () => N(0,1)
 */
function sampleReturnFactor(model, type, year, rng) {
  const rp = model.retParamsByType[type];
  if (rp.sigmaLn === 0) return Math.exp(rp.muLn);
  return Math.exp(rp.muLn + rp.sigmaLn * rng());
}

module.exports = {
  sampleStandardNormal,
  lognormalFromArithmetic,
  percentile,
  summaryPercentiles,
  allPercentiles,
  buildReturnModel,
  sampleInflationFactor,
  sampleReturnFactor,
};
