const {
  sampleStandardNormal,
  buildReturnModel,
  sampleInflationFactor,
  sampleReturnFactor,
  summaryPercentiles,
  allPercentiles,
} = require('./math');

// --- Cashflow step functions ---

function applyNetCashflow(pots, yr, primaryIdx, cumInflation) {
  let income = 0;
  for (const item of yr.income) income += item.amount;
  let expense = 0;
  for (const item of yr.expense) expense += item.amount;
  pots[primaryIdx] += (income - expense) * cumInflation;
}

function applyCapitalTransfers(pots, yr, primaryIdx, potIndex, cumInflation) {
  for (const item of yr.capitalOut) {
    const amount = item.amount * cumInflation;
    const toIdx  = potIndex[item.toPot];
    pots[primaryIdx] -= amount;
    if (toIdx !== undefined) pots[toIdx] += amount;
  }
  for (const item of yr.capitalIn) {
    const fromIdx = potIndex[item.fromPot];
    if (fromIdx === undefined) continue;
    const amount = item.amount != null
      ? item.amount * cumInflation
      : pots[fromIdx]; // full liquidation
    pots[primaryIdx] += amount;
    pots[fromIdx]    -= amount;
    if (pots[fromIdx] < 0) pots[fromIdx] = 0;
  }
}

function applySurplus(pots, yr, primaryIdx, potIndex, cumInflation) {
  if (pots[primaryIdx] <= 0 || !yr.surplusOrder || yr.surplusOrder.length === 0) return;
  for (const entry of yr.surplusOrder) {
    if (pots[primaryIdx] <= 0) break;
    const toIdx  = potIndex[entry.potId];
    if (toIdx === undefined) continue;
    const maxNom  = entry.maxAmount * cumInflation;
    const transfer = Math.min(pots[primaryIdx], maxNom);
    pots[primaryIdx] -= transfer;
    pots[toIdx]      += transfer;
  }
}

function applyDraw(pots, yr, primaryIdx, potIndex) {
  if (pots[primaryIdx] >= 0 || !yr.drawOrder || yr.drawOrder.length === 0) return;
  for (const potId of yr.drawOrder) {
    if (pots[primaryIdx] >= 0) break;
    const fromIdx = potIndex[potId];
    if (fromIdx === undefined || fromIdx === primaryIdx) continue;
    const available = Math.max(0, pots[fromIdx]);
    const needed    = -pots[primaryIdx];
    const transfer  = Math.min(available, needed);
    pots[primaryIdx] += transfer;
    pots[fromIdx]    -= transfer;
  }
}

function checkRuin(pots, isLiquid) {
  const liquidTotal = pots.reduce((s, v, i) => s + (isLiquid[i] ? v : 0), 0);
  return { ruined: liquidTotal < 0, liquidTotal };
}

// --- Single simulation path ---

/**
 * Runs one simulation path through all years.
 *
 * @param {object[]}  potDefs        - pot definitions: { id, type, initialValue }
 * @param {object[]}  years          - per-year cashflow items
 * @param {number}    retirementYear - year index of household retirement
 * @param {object}    model          - opaque return model from buildReturnModel
 * @param {boolean[]} isLiquid       - per-pot liquidity flags
 * @param {number}    primaryIdx     - index of primary pot in potDefs
 * @param {object}    potIndex       - pot id → index lookup
 * @param {function}  rng            - () => N(0,1)
 */
function runPath(potDefs, years, retirementYear, model, isLiquid, primaryIdx, potIndex, rng) {
  const pots         = potDefs.map(p => p.initialValue);
  const totalYears   = years.length;
  const drawdownYears = totalYears - retirementYear;
  let cumInflation   = 1;
  let ruined         = false;

  const liquidByYear    = new Array(totalYears);
  const realLiquidByYear      = new Array(totalYears);
  const nonLiquidByYear = new Array(totalYears);
  const realNonLiquidByYear   = new Array(totalYears);
  const totalByYear    = new Array(totalYears);
  const realTotalByYear      = new Array(totalYears);
  const drawdownSolvent = new Array(drawdownYears).fill(false);
  let retirementValue;
  let retirementRealValue;

  for (let y = 0; y < totalYears; y++) {
    const yr = years[y];

    // 1. Sample inflation.
    cumInflation *= sampleInflationFactor(model, y, rng);

    // 2–6. Cashflow steps.
    applyNetCashflow(pots, yr, primaryIdx, cumInflation);
    applyCapitalTransfers(pots, yr, primaryIdx, potIndex, cumInflation);
    applySurplus(pots, yr, primaryIdx, potIndex, cumInflation);
    applyDraw(pots, yr, primaryIdx, potIndex);

    // Ruin check.
    const { ruined: nowRuined } = checkRuin(pots, isLiquid);
    if (!ruined && nowRuined) {
      ruined = true;
      // Floor liquid pots at zero so returns don't amplify negative values.
      for (let i = 0; i < pots.length; i++) {
        if (isLiquid[i] && pots[i] < 0) pots[i] = 0;
      }
    }

    // 7. Apply stochastic return to every pot independently.
    for (let pi = 0; pi < pots.length; pi++) {
      pots[pi] *= sampleReturnFactor(model, potDefs[pi].type, y, rng);
    }

    // 8. Record all three perspectives (liquid, non-liquid, total).
    const nomLiquid = pots.reduce((s, v, i) => s + (isLiquid[i] ? v : 0), 0);
    const nomNonLiquid = pots.reduce((s, v, i) => s + (!isLiquid[i] ? v : 0), 0);
    const nomTotal = nomLiquid + nomNonLiquid;
    
    liquidByYear[y] = nomLiquid;
    realLiquidByYear[y]   = nomLiquid / cumInflation;
    nonLiquidByYear[y] = nomNonLiquid;
    realNonLiquidByYear[y]   = nomNonLiquid / cumInflation;
    totalByYear[y] = nomTotal;
    realTotalByYear[y]   = nomTotal / cumInflation;

    if (y === retirementYear - 1) {
      retirementValue     = nomLiquid;
      retirementRealValue = nomLiquid / cumInflation;
    }

    if (y >= retirementYear) {
      drawdownSolvent[y - retirementYear] = !ruined;
    }
  }

  if (retirementYear <= 0 && retirementValue === undefined) {
    retirementValue     = pots.reduce((s, v, i) => s + (isLiquid[i] ? v : 0), 0);
    retirementRealValue = retirementValue / cumInflation;
  }

  return { 
    ruined, 
    retirementValue, 
    retirementRealValue, 
    liquidByYear, 
    realByYear: realLiquidByYear,
    nonLiquidByYear,
    realNonLiquidByYear,
    totalByYear,
    realTotalByYear,
    drawdownSolvent 
  };
}

// --- Main simulation ---

function simulate(input, config, rng = sampleStandardNormal) {
  const { pots: potDefs, primaryPot: primaryPotId, retirementYear, years } = input;
  const { numSimulations } = config;

  const totalYears    = years.length;
  const drawdownYears = totalYears - retirementYear;
  const model         = buildReturnModel(config);

  const potIds     = potDefs.map(p => p.id);
  const primaryIdx = potIds.indexOf(primaryPotId);
  const isLiquid   = potDefs.map(p => p.type !== 'property');

  const potIndex = {};
  for (let i = 0; i < potDefs.length; i++) potIndex[potDefs[i].id] = i;

  const liquidValuesByYear = Array.from({ length: totalYears }, () => []);
  const realLiquidByYear   = Array.from({ length: totalYears }, () => []);
  const nonLiquidValuesByYear = Array.from({ length: totalYears }, () => []);
  const realNonLiquidByYear   = Array.from({ length: totalYears }, () => []);
  const totalValuesByYear = Array.from({ length: totalYears }, () => []);
  const realTotalByYear   = Array.from({ length: totalYears }, () => []);
  const retirementPots     = new Array(numSimulations);
  const retirementRealPots = new Array(numSimulations);
  const solventAtDrawdownYear = new Array(drawdownYears).fill(0);
  let ruinCount = 0;

  for (let sim = 0; sim < numSimulations; sim++) {
    const path = runPath(potDefs, years, retirementYear, model, isLiquid, primaryIdx, potIndex, rng);

    if (path.ruined) ruinCount++;

    for (let y = 0; y < totalYears; y++) {
      liquidValuesByYear[y].push(path.liquidByYear[y]);
      realLiquidByYear[y].push(path.realByYear[y]);
      nonLiquidValuesByYear[y].push(path.nonLiquidByYear[y]);
      realNonLiquidByYear[y].push(path.realNonLiquidByYear[y]);
      totalValuesByYear[y].push(path.totalByYear[y]);
      realTotalByYear[y].push(path.realTotalByYear[y]);
    }

    retirementPots[sim]     = path.retirementValue;
    retirementRealPots[sim] = path.retirementRealValue;

    for (let dy = 0; dy < drawdownYears; dy++) {
      if (path.drawdownSolvent[dy]) solventAtDrawdownYear[dy]++;
    }
  }

  const accumulationSnapshot = {
    yearsToRetirement: retirementYear,
    nominal: summaryPercentiles(retirementPots.filter(v => v !== undefined)),
    real:    summaryPercentiles(retirementRealPots.filter(v => v !== undefined)),
  };

  const byAge = liquidValuesByYear.map((vals, y) => ({
    yearIndex: y,
    nominal: allPercentiles(vals),
    real:    allPercentiles(realLiquidByYear[y]),
  }));

  // Build net-worth split (liquid, non-liquid, total)
  const netWorthByAge = liquidValuesByYear.map((vals, y) => ({
    yearIndex: y,
    liquid: {
      nominal: allPercentiles(liquidValuesByYear[y]),
      real:    allPercentiles(realLiquidByYear[y]),
    },
    nonLiquid: {
      nominal: allPercentiles(nonLiquidValuesByYear[y]),
      real:    allPercentiles(realNonLiquidByYear[y]),
    },
    total: {
      nominal: allPercentiles(totalValuesByYear[y]),
      real:    allPercentiles(realTotalByYear[y]),
    },
  }));

  const survivalTable = [];
  for (let dy = 0; dy < drawdownYears; dy++) {
    survivalTable.push({
      yearIndex: retirementYear + dy,
      probabilitySolvent: parseFloat((solventAtDrawdownYear[dy] / numSimulations).toFixed(4)),
    });
  }

  return {
    numSimulations,
    retirementYear,
    accumulationSnapshot,
    probabilityOfRuin: parseFloat((ruinCount / numSimulations).toFixed(4)),
    survivalTable,
    portfolioPercentiles: { byYear: byAge },
    netWorthPercentiles: { byAge: netWorthByAge },
  };
}

module.exports = { simulate };
