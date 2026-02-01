const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');
const { upload } = require('../middleware/upload');
const {
  bakerSignupStep1,
  verifyOTP,
  completeBakerProfile,
  getVerificationStatus,
  getBakerProfile,
  createProduct,
  getBakerProducts,
  updateProduct,
  deleteProduct,
  getBakerOrders,
  updateOrderStatus,
  getBakerDashboard,
  deleteImage
} = require('../controllers/baker.controller');

// Baker Signup - Step 1 (Send OTP)
router.post('/signup/step1', bakerSignupStep1);

// Verify Email OTP
router.post('/verify-otp', verifyOTP);

// Complete Baker Profile - Step 2
router.post('/profile/complete', authMiddleware, roleCheck('baker'), upload.fields([
  { name: 'profile_photo', maxCount: 1 },
  { name: 'id_proof_document', maxCount: 1 },
  { name: 'fssai_certificate', maxCount: 1 }
]), completeBakerProfile);

// Check Verification Status
router.get('/verification-status', authMiddleware, roleCheck('baker'), getVerificationStatus);

// Get Baker Profile
router.get('/profile', authMiddleware, roleCheck('baker'), getBakerProfile);

// Create Product
router.post('/products', authMiddleware, roleCheck('baker'), upload.array('images', 5), createProduct);

// Get Baker's Products
router.get('/products', authMiddleware, roleCheck('baker'), getBakerProducts);

// Update Product
router.put('/products/:id', authMiddleware, roleCheck('baker'), upload.array('images', 5), updateProduct);

// Delete Product
router.delete('/products/:id', authMiddleware, roleCheck('baker'), deleteProduct);

// Get Orders for Baker's Products
router.get('/orders', authMiddleware, roleCheck('baker'), getBakerOrders);

// Update Order Status
router.patch('/orders/:id/status', authMiddleware, roleCheck('baker'), updateOrderStatus);

// Baker Dashboard Stats
router.get('/dashboard', authMiddleware, roleCheck('baker'), getBakerDashboard);

// Delete Image (Unified Endpoint)
router.delete('/images', authMiddleware, roleCheck('baker'), deleteImage);

module.exports = router;
