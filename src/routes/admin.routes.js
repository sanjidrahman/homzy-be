const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');
const {
  getPendingBakers,
  getBakerDetails,
  approveBaker,
  rejectBaker,
  getAllBakers,
  getAllUsers,
  updateUserStatus,
  getAllProducts,
  deleteProduct,
  getAllOrders,
  getAdminDashboard
} = require('../controllers/admin.controller');

// Get Pending Baker Verifications
router.get('/bakers/pending', authMiddleware, roleCheck('admin'), getPendingBakers);

// Get Baker Details for Verification
router.get('/bakers/:id', authMiddleware, roleCheck('admin'), getBakerDetails);

// Approve Baker
router.patch('/bakers/:id/approve', authMiddleware, roleCheck('admin'), approveBaker);

// Reject Baker
router.patch('/bakers/:id/reject', authMiddleware, roleCheck('admin'), rejectBaker);

// Get All Bakers
router.get('/bakers', authMiddleware, roleCheck('admin'), getAllBakers);

// Get All Users
router.get('/users', authMiddleware, roleCheck('admin'), getAllUsers);

// Block/Unblock User
router.patch('/users/:id/status', authMiddleware, roleCheck('admin'), updateUserStatus);

// Get All Products
router.get('/products', authMiddleware, roleCheck('admin'), getAllProducts);

// Delete Product (Admin)
router.delete('/products/:id', authMiddleware, roleCheck('admin'), deleteProduct);

// Get All Orders
router.get('/orders', authMiddleware, roleCheck('admin'), getAllOrders);

// Admin Dashboard Stats
router.get('/dashboard', authMiddleware, roleCheck('admin'), getAdminDashboard);

module.exports = router;
