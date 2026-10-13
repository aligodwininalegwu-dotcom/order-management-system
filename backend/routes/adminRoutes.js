const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// GET /api/admin/stats - sales and inventory figures for the dashboard
router.get('/stats', protect, admin, getStats);

module.exports = router;
