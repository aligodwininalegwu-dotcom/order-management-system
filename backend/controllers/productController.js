const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// Escape user input before using it in a RegExp (prevents ReDoS / regex injection).
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Only these fields can be written through the API (blocks mass assignment).
const WRITABLE_FIELDS = [
  'name',
  'description',
  'price',
  'category',
  'sku',
  'stockQuantity',
  'imageUrl',
  'isActive',
];

const pickWritable = (body) =>
  Object.fromEntries(Object.entries(body).filter(([key]) => WRITABLE_FIELDS.includes(key)));

/**
 * @desc    Get all products (supports optional category filter and search)
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = asyncHandler(async (req, res) => {
  const { category, search } = req.query;

  // Build a query object dynamically based on whatever filters were passed
  // in the URL, e.g. /api/products?category=Shoes&search=nike
  const query = { isActive: true };

  if (category) {
    query.category = String(category);
  }

  if (search) {
    // Case-insensitive partial match on the product name
    query.name = { $regex: escapeRegex(String(search).slice(0, 100)), $options: 'i' };
  }

  const products = await Product.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
});

/**
 * @desc    Get a single product by its id
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Private/Admin
 */
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, category, sku, stockQuantity, imageUrl } =
    req.body;

  if (!name || !description || price === undefined || price === '' || !category) {
    res.status(400);
    throw new Error('Please provide name, description, price, and category');
  }

  const product = await Product.create({
    name,
    description,
    price,
    category,
    sku,
    stockQuantity,
    imageUrl,
  });

  res.status(201).json({
    success: true,
    data: product,
  });
});

/**
 * @desc    Update an existing product
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Object.assign only overwrites fields that were actually sent in the
  // request body, leaving everything else on the product untouched.
  Object.assign(product, pickWritable(req.body));

  const updatedProduct = await product.save();

  res.status(200).json({
    success: true,
    data: updatedProduct,
  });
});

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Product removed',
  });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};