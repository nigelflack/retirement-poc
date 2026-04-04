const express = require('express');
const cors = require('cors');
const simulateRoute = require('./routes/simulate');
const solveRoute = require('./routes/solve');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/simulate', simulateRoute);
app.use('/solve', solveRoute);

// POST /run removed in v0.11 — use POST /simulate
app.all('/run', (req, res) => res.status(404).json({ error: 'POST /run has been removed. Use POST /simulate.' }));

app.listen(PORT, () => {
  console.log(`Retirement model server running on port ${PORT}`);
});
