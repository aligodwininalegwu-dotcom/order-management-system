const REQUIRED = ['MONGO_URI', 'JWT_SECRET', 'PAYSTACK_SECRET_KEY', 'CLIENT_URL'];

/**
 * Fails fast at startup when required configuration is missing, instead of
 * surfacing as an obscure runtime error on the first request that needs it.
 */
const validateEnv = () => {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.JWT_SECRET.length < 32 ||
      process.env.JWT_SECRET.startsWith('replace_this'))
  ) {
    throw new Error('JWT_SECRET must be a random string of at least 32 characters in production');
  }
};

module.exports = validateEnv;
