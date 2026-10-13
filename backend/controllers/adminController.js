const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;
const LOW_STOCK_THRESHOLD = 5;
const TIMEZONE = 'Africa/Lagos';

const sumSuccessful = async (from, to) => {
  const [result] = await Transaction.aggregate([
    { $match: { status: 'success', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return { total: result?.total || 0, count: result?.count || 0 };
};

/**
 * @desc    Dashboard figures for the admin overview page
 * @route   GET /api/admin/stats
 * @access  Private/Admin
 */
const getStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * DAY_MS);
  const prev30 = new Date(now.getTime() - 60 * DAY_MS);
  const chartStart = new Date(now.getTime() - 13 * DAY_MS);
  chartStart.setHours(0, 0, 0, 0);

  const [
    allTime,
    current,
    previous,
    statusCounts,
    dailyRevenue,
    customers,
    activeProducts,
    lowStock,
    recentOrders,
    pendingPayments,
  ] = await Promise.all([
    sumSuccessful(new Date(0), new Date(now.getTime() + DAY_MS)),
    sumSuccessful(last30, new Date(now.getTime() + DAY_MS)),
    sumSuccessful(prev30, last30),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Transaction.aggregate([
      { $match: { status: 'success', paidAt: { $gte: chartStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: TIMEZONE } },
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
    ]),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ isActive: true }),
    Product.find({ isActive: true, stockQuantity: { $lte: LOW_STOCK_THRESHOLD } })
      .sort({ stockQuantity: 1 })
      .limit(6)
      .select('name stockQuantity category imageUrl'),
    Order.find({}).sort({ createdAt: -1 }).limit(6).populate('user', 'name email'),
    Order.countDocuments({ paymentStatus: 'pending', status: { $ne: 'cancelled' } }),
  ]);

  // Fill in days with no sales so the chart always shows 14 continuous days.
  const byDay = new Map(dailyRevenue.map((d) => [d._id, d]));
  const series = [];
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(chartStart.getTime() + i * DAY_MS);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(day);
    series.push({
      date: key,
      revenue: byDay.get(key)?.revenue || 0,
      orders: byDay.get(key)?.orders || 0,
    });
  }

  const orders = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const totalOrders = Object.values(orders).reduce((sum, n) => sum + n, 0);

  res.status(200).json({
    success: true,
    data: {
      revenue: {
        allTime: allTime.total,
        last30Days: current.total,
        previous30Days: previous.total,
        paidOrdersLast30Days: current.count,
        averageOrderValue: current.count ? Math.round(current.total / current.count) : 0,
      },
      orders: {
        total: totalOrders,
        byStatus: orders,
        awaitingPayment: pendingPayments,
      },
      customers,
      activeProducts,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      lowStock,
      recentOrders,
      dailyRevenue: series,
    },
  });
});

module.exports = { getStats };
