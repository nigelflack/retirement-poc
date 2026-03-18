const express = require('express');
const simulateRoute = require('./routes/simulate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/simulate', simulateRoute);

app.listen(PORT, () => {
  console.log(`Retirement model server running on port ${PORT}`);
});
