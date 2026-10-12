const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

/**
 * Protects a route by requiring a valid JWT in the Authorization header,
 * formatted as: Authorization: Bearer <token>
 *
 * If valid, the corresponding user document (minus password) is attached
 * to req.user so downstream controllers can access it, e.g. req.user._id.
 */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, token failed or expired');
  }

  // Attach the user to the request, excluding the password field.
  req.user = await User.findById(decoded.id).select('-password');

  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, user no longer exists');
  }

  next();
});

/**
 * Restricts a route to users with the 'admin' role. Must be used AFTER
 * the protect middleware, since it relies on req.user being set.
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403);
  throw new Error('Not authorized as an admin');
};

module.exports = { protect, admin };
