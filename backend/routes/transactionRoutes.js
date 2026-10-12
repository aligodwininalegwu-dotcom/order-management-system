const express = require('express');
const router = express.Router();
const {
  initializeTransaction,
  verifyTransaction,
} = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');

// Start a payment for an order - returns a Paystack checkout URL.
router.post('/initialize', protect, initializeTransaction);

// Confirm whether a payment actually succeeded, directly with Paystack.
router.get('/verify/:reference', protect, verifyTransaction);

module.exports = router;