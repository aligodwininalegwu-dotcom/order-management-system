/**
 * Handles requests to undefined routes by generating a 404 error
 * and forwarding it to the centralized error handler below.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Centralized error handler. Express identifies this as an error-handling
 * middleware because it accepts four arguments. Any error passed via
 * next(error) from controllers or the notFound handler above will land here.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Controllers set res.status() before throwing; errors raised by helpers
  // may carry their own statusCode. Anything left at 200 is a server fault.
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;

  // Mongoose bad ObjectId (CastError) - treat as a 404 rather than 500.
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Mongoose schema validation failures are the client's fault.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
  }

  // Duplicate key on a unique index (e.g. email or SKU already in use).
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `That ${field} is already in use`;
  }

  // Malformed JSON body.
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (statusCode >= 500) {
    console.error(err);
    // Don't leak internals of unexpected failures to clients in production.
    if (isProduction) message = 'Internal server error';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Stack traces are only useful (and safe) to expose in development.
    stack: isProduction ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
