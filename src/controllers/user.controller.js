const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Get All Products
const getAllProducts = async (req, res) => {
  try {
    const { category, baker_id, search } = req.query;

    let query = `
      SELECT p.*, u.name as baker_name, u.email as baker_email, u.phone as baker_phone,
             bp.bakery_name, c.name as category_name
      FROM products p
      INNER JOIN users u ON p.baker_id = u.id
      INNER JOIN baker_profiles bp ON u.id = bp.user_id
      INNER JOIN categories c ON p.category_id = c.id
      WHERE u.is_verified = true AND u.role = 'baker' AND p.is_available = true
    `;

    const params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND p.category_id = $${paramCount}`;
      params.push(category);
    }

    if (baker_id) {
      paramCount++;
      query += ` AND p.baker_id = $${paramCount}`;
      params.push(baker_id);
    }

    if (search) {
      paramCount++;
      query += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await db.query(query, params);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Single Product
const getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT p.*, u.name as baker_name, u.email as baker_email, u.phone as baker_phone,
              bp.bakery_name, bp.city as baker_city, bp.state as baker_state,
              c.name as category_name
       FROM products p
       INNER JOIN users u ON p.baker_id = u.id
       INNER JOIN baker_profiles bp ON u.id = bp.user_id
       INNER JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Get single product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All Approved Bakers
const getAllBakers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.*, bp.*
        FROM users u
        INNER JOIN baker_profiles bp ON u.id = bp.user_id
        WHERE u.role = 'baker' AND u.is_verified = true AND bp.verification_status = 'approved'
      ORDER BY u.created_at DESC`
    );

    res.json({ bakers: result.rows });
  } catch (error) {
    console.error('Get all bakers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Product Reviews
const getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT r.*, u.name as reviewer_name
       FROM reviews r
       INNER JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    res.json({ reviews: result.rows });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add Review
const addReview = async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;

    // Check if user already reviewed
    const existingReview = await db.query(
      'SELECT * FROM reviews WHERE user_id = $1 AND product_id = $2',
      [req.user.id, product_id]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    // Generate UUID for review
    const reviewId = uuidv4();

    // Insert review
    await db.query(
      'INSERT INTO reviews (id, user_id, product_id, rating, comment) VALUES ($1, $2, $3, $4, $5)',
      [reviewId, req.user.id, product_id, rating, comment]
    );

    res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Place Order
const placeOrder = async (req, res) => {
  try {
    const { items, total_amount, delivery_address, payment_id } = req.body;

    // Generate UUID for order
    const orderId = uuidv4();

    // Insert order with separate delivery address columns
    await db.query(
      `INSERT INTO orders (id, user_id, total_amount, delivery_street, delivery_city, delivery_state, delivery_pincode, payment_id, payment_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        orderId,
        req.user.id,
        total_amount,
        delivery_address.street,
        delivery_address.city,
        delivery_address.state,
        delivery_address.pincode,
        payment_id,
        'pending',
        'pending'
      ]
    );

    // Insert order items
    for (const item of items) {
      const orderItemId = uuidv4();
      await db.query(
        `INSERT INTO order_items (id, order_id, product_id, baker_id, quantity, price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderItemId, orderId, item.product_id, item.baker_id, item.quantity, item.price]
      );
    }

    // Get created order with items
    const result = await db.query(
      `SELECT o.*, oi.*, p.name as product_name
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       INNER JOIN products p ON oi.product_id = p.id
       WHERE o.id = $1`,
      [orderId]
    );

    res.status(201).json({
      message: 'Order placed successfully',
      order: { id: orderId, items: result.rows }
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get User Order History
const getUserOrders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, oi.product_id, oi.quantity, oi.price as item_price, p.name as product_name, p.image_urls
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       INNER JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Group by order
    const ordersMap = new Map();
    result.rows.forEach(row => {
      if (!ordersMap.has(row.id)) {
        ordersMap.set(row.id, {
          id: row.id,
          total_amount: row.total_amount,
          delivery_address: row.delivery_address,
          payment_status: row.payment_status,
          status: row.status,
          created_at: row.created_at,
          items: []
        });
      }
      ordersMap.get(row.id).items.push({
        product_id: row.product_id,
        product_name: row.product_name,
        image_urls: row.image_urls,
        quantity: row.quantity,
        price: row.item_price
      });
    });

    res.json({ orders: Array.from(ordersMap.values()) });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Single Order Details
const getSingleOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if order belongs to user
    const orderCheck = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order with items and baker details
    const result = await db.query(
      `SELECT o.*, oi.product_id, oi.quantity, oi.price as item_price, oi.baker_id,
              p.name as product_name, p.image_urls,
              u.name as baker_name, u.email as baker_email, u.phone as baker_phone,
              bp.bakery_name
       FROM orders o
       INNER JOIN order_items oi ON o.id = oi.order_id
       INNER JOIN products p ON oi.product_id = p.id
       INNER JOIN users u ON oi.baker_id = u.id
       INNER JOIN baker_profiles bp ON u.id = bp.user_id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Group items by order
    const order = {
      id: result.rows[0].id,
      total_amount: result.rows[0].total_amount,
      delivery_address: result.rows[0].delivery_address,
      payment_status: result.rows[0].payment_status,
      status: result.rows[0].status,
      created_at: result.rows[0].created_at,
      items: result.rows.map(row => ({
        product_id: row.product_id,
        product_name: row.product_name,
        image_urls: row.image_urls,
        quantity: row.quantity,
        price: row.item_price,
        baker_id: row.baker_id,
        baker_name: row.baker_name,
        bakery_name: row.bakery_name
      }))
    };

    res.json({ order });
  } catch (error) {
    console.error('Get single order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete Review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if review exists and belongs to user
    const reviewCheck = await db.query(
      'SELECT * FROM reviews WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Delete review
    await db.query('DELETE FROM reviews WHERE id = $1', [id]);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllProducts,
  getSingleProduct,
  getAllBakers,
  getProductReviews,
  addReview,
  deleteReview,
  placeOrder,
  getUserOrders,
  getSingleOrder
};
