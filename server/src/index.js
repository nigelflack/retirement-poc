const express = require('express');
const cors = require('cors');
const runRoute = require('./routes/run');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/run', runRoute);

app.listen(PORT, () => {
  console.log(`Retirement model server running on port ${PORT}`);
});
