const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getMe,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/auth/register - create a new account
router.post('/register', registerUser);

// POST /api/auth/login - log in and receive a JWT
router.post('/login', loginUser);

// GET /api/auth/me - get the logged-in user's own profile (requires token)
router.get('/me', protect, getMe);

// POST /api/auth/forgot-password - request a password reset link
router.post('/forgot-password', forgotPassword);

// PUT /api/auth/reset-password/:token - set a new password using a valid token
router.put('/reset-password/:token', resetPassword);

module.exports = router;