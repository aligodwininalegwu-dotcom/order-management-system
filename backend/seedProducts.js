// One-off script to seed the database with a realistic product catalog,
// including real product photos, so the storefront looks like a real
// site instead of a single test item.
// Usage: node seedProducts.js
// Safe to re-run: it skips any product whose name already exists.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Product = require('./models/Product');

const products = [
  {
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with a USB receiver and silent-click buttons.',
    price: 8500,
    category: 'Electronics',
    stockQuantity: 45,
    imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Bluetooth Over-Ear Headphones',
    description: 'Noise-isolating over-ear headphones with 30-hour battery life and deep bass.',
    price: 24500,
    category: 'Electronics',
    stockQuantity: 30,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Smart Fitness Watch',
    description: 'Tracks heart rate, sleep, and workouts, with smartphone notifications.',
    price: 32000,
    category: 'Electronics',
    stockQuantity: 25,
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Mechanical Keyboard',
    description: 'Backlit mechanical keyboard with tactile switches for fast, accurate typing.',
    price: 21000,
    category: 'Electronics',
    stockQuantity: 20,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Portable Power Bank 20000mAh',
    description: 'High-capacity power bank with fast charging for phones and tablets.',
    price: 12500,
    category: 'Electronics',
    stockQuantity: 40,
    imageUrl: 'https://images.unsplash.com/photo-1609592806596-4d8b5b1d7d13?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Leather Laptop Backpack',
    description: 'Water-resistant backpack with a padded laptop compartment and USB port.',
    price: 18500,
    category: 'Fashion',
    stockQuantity: 22,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Classic Aviator Sunglasses',
    description: 'UV-protected polarized lenses with a lightweight metal frame.',
    price: 9500,
    category: 'Fashion',
    stockQuantity: 35,
    imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Running Sneakers',
    description: 'Breathable mesh running shoes with cushioned soles for daily training.',
    price: 27500,
    category: 'Fashion',
    stockQuantity: 18,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'LED Desk Lamp',
    description: 'Adjustable brightness desk lamp with a flexible arm and USB charging port.',
    price: 7500,
    category: 'Home & Office',
    stockQuantity: 28,
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Ergonomic Office Chair',
    description: 'Adjustable-height office chair with lumbar support and breathable mesh back.',
    price: 65000,
    category: 'Home & Office',
    stockQuantity: 10,
    imageUrl: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Espresso Coffee Maker',
    description: 'Compact espresso machine with milk frother for cafe-style coffee at home.',
    price: 45000,
    category: 'Home & Office',
    stockQuantity: 12,
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
  },
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    let created = 0;
    let skipped = 0;

    for (const productData of products) {
      const exists = await Product.findOne({ name: productData.name });
      if (exists) {
        skipped++;
        continue;
      }
      await Product.create(productData);
      created++;
    }

    console.log(`Done. Created ${created} new products, skipped ${skipped} that already existed.`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();