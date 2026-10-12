const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Health check endpoint used by uptime monitors and load balancers.
// Reports 503 when the database connection is down.
router.get('/', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    message: dbConnected ? 'Online Store API is running' : 'Database unavailable',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
