const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a product name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    price: {
      type: Number,
      required: [true, 'Please add a price'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Please add a category'],
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple documents without an sku value
      trim: true,
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Please add a stock quantity'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true, // Lets a product be "delisted" without deleting it
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Product', productSchema);