const express = require('express');
const router = express.Router();
const { runSimulation } = require('../simulation/monteCarlo');
const simulationConfig = require('../../config/simulation.json');

router.post('/', (req, res) => {
  const { people } = req.body;

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

  const simulationPeople = people.map(person => ({
    name: person.name,
    initialValue: person.accounts.reduce((sum, a) => sum + (a.currentValue || 0), 0),
    annualContribution: person.accounts.reduce((sum, a) => sum + (a.monthlyContribution || 0), 0) * 12,
    yearsToRetirement: person.retirementAge - person.currentAge,
  }));

  const results = runSimulation(simulationPeople, simulationConfig);

  res.json({
    numSimulations: simulationConfig.numSimulations,
    ...results,
  });
});

module.exports = router;
