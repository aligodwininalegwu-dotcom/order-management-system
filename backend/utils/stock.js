const Product = require('../models/Product');

/**
 * Atomically reserves stock for a list of { product, quantity } lines.
 * Each decrement is a single conditional update, so two concurrent orders
 * can never both claim the last unit. If any line fails, the lines already
 * reserved are rolled back and an error with a 4xx `statusCode` is thrown.
 */
const reserveStock = async (lines) => {
  const reserved = [];

  try {
    for (const { product, quantity } of lines) {
      const updated = await Product.findOneAndUpdate(
        { _id: product, isActive: true, stockQuantity: { $gte: quantity } },
        { $inc: { stockQuantity: -quantity } },
        { new: true }
      );

      if (!updated) {
        const existing = await Product.findById(product);
        const error = new Error(
          !existing || !existing.isActive
            ? `Product not found: ${product}`
            : `Insufficient stock for "${existing.name}". Available: ${existing.stockQuantity}`
        );
        error.statusCode = !existing || !existing.isActive ? 404 : 400;
        throw error;
      }

      reserved.push({ product, quantity, name: updated.name, price: updated.price });
    }
  } catch (error) {
    await releaseStock(reserved);
    throw error;
  }

  return reserved;
};

/** Returns previously reserved stock to inventory (cancelled orders, rollbacks). */
const releaseStock = async (lines) => {
  if (!lines.length) return;

  await Product.bulkWrite(
    lines.map(({ product, quantity }) => ({
      updateOne: {
        filter: { _id: product },
        update: { $inc: { stockQuantity: quantity } },
      },
    }))
  );
};

module.exports = { reserveStock, releaseStock };
