const express = require('express');
const router = express.Router();
const { runDrawdown } = require('../simulation/drawdown');
const simulationConfig = require('../../config/simulation.json');

router.post('/', (req, res) => {
  const { paths, realPaths, withdrawalRate, retirementAge, toAge } = req.body;

  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'paths must be a non-empty array' });
  }
  if (typeof withdrawalRate !== 'number' || withdrawalRate <= 0 || withdrawalRate >= 1) {
    return res.status(400).json({ error: 'withdrawalRate must be a number between 0 and 1' });
  }
  if (typeof retirementAge !== 'number' || typeof toAge !== 'number') {
    return res.status(400).json({ error: 'retirementAge and toAge must be numbers' });
  }
  if (toAge <= retirementAge) {
    return res.status(400).json({ error: 'toAge must be greater than retirementAge' });
  }

  const results = runDrawdown({ paths, realPaths, withdrawalRate, retirementAge, toAge }, simulationConfig);

  res.json(results);
});

module.exports = router;
