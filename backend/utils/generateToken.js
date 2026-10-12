const jwt = require('jsonwebtoken');

/**
 * Signs a JWT containing the user's id. This token is what the frontend
 * will store (e.g. in localStorage or a cookie) and send back on every
 * subsequent request to prove who is making it.
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

module.exports = generateToken;