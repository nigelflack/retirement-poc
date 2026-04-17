const express = require('express');
const router = express.Router();

// Solve endpoints are not implemented in v0.16.
// They will be rebuilt in a future iteration once the cashflow adapter is stable.
router.post('/income', (_req, res) => {
  res.status(501).json({ error: 'POST /solve/income is not implemented in v0.16. See backlog.' });
});

router.post('/ages', (_req, res) => {
  res.status(501).json({ error: 'POST /solve/ages is not implemented in v0.16. See backlog.' });
});

module.exports = router;

