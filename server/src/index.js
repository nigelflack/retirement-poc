const express = require('express');
const cors = require('cors');
const runRoute = require('./routes/run');
const solveRoute = require('./routes/solve');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/run', runRoute);
app.use('/solve', solveRoute);

app.listen(PORT, () => {
  console.log(`Retirement model server running on port ${PORT}`);
});
