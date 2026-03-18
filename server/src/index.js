const express = require('express');
const simulateRoute = require('./routes/simulate');
const drawdownRoute = require('./routes/drawdown');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use('/simulate', simulateRoute);
app.use('/drawdown', drawdownRoute);

app.listen(PORT, () => {
  console.log(`Retirement model server running on port ${PORT}`);
});
