// Promotes an existing user to admin.
// Usage: npm run make-admin -- user@example.com

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');

const email = (process.argv[2] || '').trim().toLowerCase();

const run = async () => {
  if (!email) {
    console.error('Usage: npm run make-admin -- <email>');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await User.updateOne({ email }, { $set: { role: 'admin' } });

    if (result.matchedCount === 0) {
      console.error(`No user found with email: ${email}`);
      process.exitCode = 1;
    } else {
      console.log(`Success: ${email} is now an admin.`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
