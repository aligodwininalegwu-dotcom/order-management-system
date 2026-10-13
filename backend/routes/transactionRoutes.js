const express = require('express');
const router = express.Router();
const {
  initializeTransaction,
  verifyTransaction,
  getMyTransactions,
  getAllTransactions,
} = require('../controllers/transactionController');
const { protect, admin } = require('../middleware/authMiddleware');

// Start a payment for an order - returns a Paystack checkout URL.
router.post('/initialize', protect, initializeTransaction);

// Confirm whether a payment actually succeeded, directly with Paystack.
router.get('/verify/:reference', protect, verifyTransaction);

// Customer: their own payment history.
router.get('/my', protect, getMyTransactions);

// Admin: every transaction in the system.
router.get('/', protect, admin, getAllTransactions);

module.exports = router;