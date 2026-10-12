const mongoose = require('mongoose');

/**
 * Establishes a connection to MongoDB using the URI supplied in the
 * environment configuration (MONGO_URI). The connection is established
 * once when the server starts, and Mongoose manages pooling internally
 * for all subsequent queries made through the defined models.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Exit process with failure since the application cannot function
    // without a database connection.
    process.exit(1);
  }
};

module.exports = connectDB;
