// index.js

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Import routes
const healthRoutes = require('./routes/healthRoutes');

app.use('/api/health', healthRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
