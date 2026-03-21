const express = require('express');
const router = express.Router();
const { runFull } = require('../simulation/run');
const simulationConfig = require('../../config/simulation.json');

router.post('/', (req, res) => {
  const { people, withdrawalRate, toAge = 100 } = req.body;

  if (!Array.isArray(people) || people.length === 0) {
    return res.status(400).json({ error: 'people must be a non-empty array' });
  }

  for (const person of people) {
    if (!person.name || person.currentAge == null || person.retirementAge == null || !Array.isArray(person.accounts)) {
      return res.status(400).json({
        error: 'Each person must have name, currentAge, retirementAge, and accounts array',
      });
    }
    if (typeof person.currentAge !== 'number' || typeof person.retirementAge !== 'number') {
      return res.status(400).json({ error: 'currentAge and retirementAge must be numbers' });
    }
    if (person.retirementAge <= person.currentAge) {
      return res.status(400).json({
        error: `retirementAge must be greater than currentAge for ${person.name}`,
      });
    }
  }

  if (typeof withdrawalRate !== 'number' || withdrawalRate <= 0 || withdrawalRate >= 1) {
    return res.status(400).json({ error: 'withdrawalRate must be a number between 0 and 1' });
  }
  if (typeof toAge !== 'number' || toAge <= 0) {
    return res.status(400).json({ error: 'toAge must be a positive number' });
  }

  const results = runFull({ people, withdrawalRate, toAge }, simulationConfig);
  res.json(results);
});

module.exports = router;
