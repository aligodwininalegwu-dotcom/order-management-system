const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Coerce to a lowercase string so a JSON body like {"email": {"$gt": ""}}
// can never reach a Mongo query as an operator object.
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password ?? '');
  const phone = req.body.phone ? String(req.body.phone).trim() : undefined;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please provide name, email, and password');
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('A user with that email already exists');
  }

  // Password hashing happens automatically via the pre('save') hook
  // defined on the User model - we just pass the plain password here.
  const user = await User.create({ name, email, password, phone });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

/**
 * @desc    Authenticate a user and return a token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password ?? '');

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  // .select('+password') is required here because the User model excludes
  // the password field by default (select: false).
  const user = await User.findOne({ email }).select('+password');

  if (user && (await user.matchPassword(password))) {
    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

/**
 * @desc    Get the currently logged-in user's profile
 * @route   GET /api/auth/me
 * @access  Private (requires a valid token)
 */
const getMe = asyncHandler(async (req, res) => {
  // req.user is set by the protect middleware after verifying the token.
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

/**
 * @desc    Request a password reset. Generates a reset token.
 * @route   POST /api/auth/forgot-password
 * @access  Public
 *
 * NOTE: This project has no email service configured, so instead of
 * emailing the reset link, we return it directly in the response. In a
 * production system, you would send resetUrl by email instead of
 * returning it to the client.
 */
const genericResetResponse = {
  success: true,
  message: 'If an account with that email exists, a reset link has been sent.',
};

const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    res.status(400);
    throw new Error('Please provide an email');
  }

  const user = await User.findOne({ email });

  // Don't reveal whether the email exists - respond the same way either
  // way. But since we're returning the link directly (no email service),
  // we only have a link to give back when the user actually exists.
  if (!user) {
    return res.status(200).json(genericResetResponse);
  }

  const rawToken = user.generatePasswordResetToken();
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  // SECURITY: returning the link to the requester would let anyone take over
  // any account just by typing its email. It is therefore only exposed
  // outside production, as a stand-in for email delivery. In production,
  // send resetUrl with a mail service instead.
  if (process.env.NODE_ENV === 'production') {
    return res.status(200).json(genericResetResponse);
  }

  res.status(200).json({
    success: true,
    message: 'Reset link generated (development only).',
    resetUrl,
  });
});

/**
 * @desc    Reset a password using a valid reset token
 * @route   PUT /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const password = String(req.body.password ?? '');

  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire');

  if (!user) {
    res.status(400);
    throw new Error('This reset link is invalid or has expired');
  }

  user.password = password; // Hashed automatically by the pre('save') hook
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    },
  });
});

/**
 * @desc    Update the logged-in user's profile
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  const name = String(req.body.name ?? user.name).trim();
  if (!name) {
    res.status(400);
    throw new Error('Name cannot be empty');
  }

  user.name = name;
  if (req.body.phone !== undefined) user.phone = String(req.body.phone).trim();
  if (req.body.address && typeof req.body.address === 'object') {
    user.address = {
      street: String(req.body.address.street ?? '').trim(),
      city: String(req.body.address.city ?? '').trim(),
      state: String(req.body.address.state ?? '').trim(),
    };
  }
  await user.save();

  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Change the logged-in user's password
 * @route   PUT /api/auth/me/password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword ?? '');
  const newPassword = String(req.body.newPassword ?? '');

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error('Your current password is incorrect');
  }

  user.password = newPassword; // Hashed by the pre('save') hook
  await user.save();

  res.status(200).json({ success: true, message: 'Password updated' });
});

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};