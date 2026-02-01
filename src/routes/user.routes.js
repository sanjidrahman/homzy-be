const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');
const {
  getAllProducts,
  getSingleProduct,
  getAllBakers,
  getProductReviews,
  addReview,
  deleteReview,
  placeOrder,
  getUserOrders,
  getSingleOrder
} = require('../controllers/user.controller');

// Get All Products (Public)
router.get('/products', getAllProducts);

// Get Single Product (Public)
router.get('/products/:id', getSingleProduct);

// Get All Approved Bakers (Public)
router.get('/bakers', getAllBakers);

// Get Product Reviews (Public)
router.get('/products/:id/reviews', getProductReviews);

// Add Review (User only)
router.post('/reviews', authMiddleware, roleCheck('user'), addReview);

// Delete Review (User only)
router.delete('/reviews/:id', authMiddleware, roleCheck('user'), deleteReview);

// Place Order (User only)
router.post('/orders', authMiddleware, roleCheck('user'), placeOrder);

// Get User Order History (User only)
router.get('/orders', authMiddleware, roleCheck('user'), getUserOrders);

// Get Single Order Details (User only)
router.get('/orders/:id', authMiddleware, roleCheck('user'), getSingleOrder);

module.exports = router;
