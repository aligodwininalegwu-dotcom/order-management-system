const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const validateEnv = require('./utils/validateEnv');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const healthRoutes = require('./routes/healthRoutes');
const { handleWebhook } = require('./controllers/transactionController');

validateEnv();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Required for correct client IPs (rate limiting) behind a proxy/load balancer.
if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');

// --- Global middleware ---
app.use(helmet()); // Sets sensible security-related HTTP headers
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// The Paystack webhook signature is computed over the raw bytes, so this
// route must be registered BEFORE express.json() parses the body.
app.post(
  '/api/transactions/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  handleWebhook
);

app.use(express.json({ limit: '100kb' })); // Parses incoming JSON request bodies
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Logs each request to the console during development
}

// --- Rate limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

app.use('/api', apiLimiter);
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password'], authLimiter);

// --- Routes ---
app.use('/api/health', healthRoutes);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// --- Error handling middleware (must be registered last) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(
      `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
    );
  });

  // Finish in-flight requests and close the DB connection on shutdown.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (require.main === module) {
  start();
}

module.exports = app;
