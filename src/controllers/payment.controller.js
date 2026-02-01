const razorpay = require('../config/stripe');
const crypto = require('crypto');
const db = require('../config/database');

// Create Razorpay Order
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Amount in paise (1 INR = 100 paise)
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        user_id: req.user.id,
        order_id: order_id // Store database order ID in notes
      }
    };

    const order = await razorpay.orders.create(options);

    // Update orders table with razorpay_order_id
    await db.query(
      'UPDATE orders SET razorpay_order_id = $1 WHERE id = $2',
      [order.id, order_id]
    );

    res.json({
      orderId: order.id,
      order_id: order_id, // Return the database order ID
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Verify Payment Signature
const confirmPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id
    } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id (database UUID) is required' });
    }

    // Verify signature
    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== 'captured') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    // Update order payment status
    await db.query(
      'UPDATE orders SET payment_id = $1, payment_status = $2 WHERE id = $3',
      [razorpay_payment_id, 'completed', order_id]
    );

    res.json({ message: 'Payment confirmed successfully' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createPaymentIntent, confirmPayment };
