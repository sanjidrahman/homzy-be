const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { createPaymentIntent, confirmPayment } = require('../controllers/payment.controller');

// Create Payment Intent
router.post('/create-intent', authMiddleware, createPaymentIntent);

// Confirm Payment
router.post('/confirm', authMiddleware, confirmPayment);

module.exports = router;
