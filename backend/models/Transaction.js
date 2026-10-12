const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true, // Paystack transaction reference - must be unique
    },
    amount: {
      type: Number,
      required: true, // Stored in Naira (not kobo) for readability
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String, // e.g. 'card', 'bank_transfer', 'ussd' - filled in from Paystack's response
      default: '',
    },
    paystackResponse: {
      type: mongoose.Schema.Types.Mixed, // Raw response payload from Paystack, kept for audit/debugging
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);