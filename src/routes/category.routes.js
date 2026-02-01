const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');
const {
  createCategory,
  getAllCategories
} = require('../controllers/category.controller');

// Create Category (TEMPORARY ENDPOINT - Remove after seeding data)
// TODO: Remove this endpoint after adding initial categories
router.post('/categories', authMiddleware, roleCheck('admin'), createCategory);

// Get All Categories (PERMANENT ENDPOINT - Public access, no auth required)
router.get('/categories', getAllCategories);

module.exports = router;
