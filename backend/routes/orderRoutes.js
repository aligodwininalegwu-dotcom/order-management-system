const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrders,
  updateOrderStatus,
  cancelOrder,
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

// IMPORTANT: '/my-orders' must be declared BEFORE '/:id', otherwise Express
// would treat "my-orders" as if it were an :id value and route it wrong.
router.get('/my-orders', protect, getMyOrders);

// Any logged-in user can place an order.
router.post('/', protect, createOrder);

// Admin-only: view every order in the system.
router.get('/', protect, admin, getOrders);

// Owner or admin: view a specific order (ownership is checked inside the controller).
router.get('/:id', protect, getOrderById);

// Owner only: cancel their own unpaid order.
router.put('/:id/cancel', protect, cancelOrder);

// Admin-only: update an order's fulfillment status.
router.put('/:id/status', protect, admin, updateOrderStatus);

module.exports = router;