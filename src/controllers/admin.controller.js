const db = require('../config/database');

// Get Pending Baker Verifications
const getPendingBakers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              bp.id as profile_id, bp.bakery_name, bp.city, bp.state,
              bp.profile_photo, bp.id_proof_document, bp.id_proof_type,
              bp.id_proof_number, bp.fssai_number
       FROM users u
       INNER JOIN baker_profiles bp ON u.id = bp.user_id
       WHERE bp.verification_status = 'pending'
       ORDER BY u.created_at DESC`
    );

    res.json({ bakers: result.rows });
  } catch (error) {
    console.error('Get pending bakers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Baker Details for Verification
const getBakerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT u.*, bp.*
       FROM users u
       INNER JOIN baker_profiles bp ON u.id = bp.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Baker not found' });
    }

    res.json({ baker: result.rows[0] });
  } catch (error) {
    console.error('Get baker details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve Baker
const approveBaker = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `UPDATE baker_profiles
       SET verification_status = 'approved', verified_by = $1, verified_at = NOW()
       WHERE user_id = $2`,
      [req.user.id, id]
    );

    await db.query(
      'UPDATE users SET is_verified = true WHERE id = $1',
      [id]
    );

    res.json({ message: 'Baker approved successfully' });
  } catch (error) {
    console.error('Approve baker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject Baker
const rejectBaker = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    await db.query(
      `UPDATE baker_profiles
       SET verification_status = 'rejected', verified_by = $1, verified_at = NOW(), rejection_reason = $2
       WHERE user_id = $3`,
      [req.user.id, rejection_reason, id]
    );

    res.json({ message: 'Baker rejected successfully' });
  } catch (error) {
    console.error('Reject baker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All Bakers
const getAllBakers = async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT u.id, u.name, u.email, u.phone, u.is_verified, u.created_at,
             bp.bakery_name, bp.city, bp.state, bp.verification_status,
             bp.verified_at, bp.rejection_reason
      FROM users u
      INNER JOIN baker_profiles bp ON u.id = bp.user_id
      WHERE u.role = 'baker'
    `;

    const params = [];

    if (status) {
      query += ' AND bp.verification_status = $1';
      params.push(status);
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await db.query(query, params);

    res.json({ bakers: result.rows });
  } catch (error) {
    console.error('Get all bakers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, phone, status, created_at
       FROM users
       WHERE role = 'user'
       ORDER BY created_at DESC`
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Block/Unblock User
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.query(
      'UPDATE users SET status = $1 WHERE id = $2',
      [status, id]
    );

    res.json({ message: `User ${status} successfully` });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All Products
const getAllProducts = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, u.name as baker_name, u.email as baker_email,
              bp.bakery_name, c.name as category_name
       FROM products p
       INNER JOIN users u ON p.baker_id = u.id
       INNER JOIN baker_profiles bp ON u.id = bp.user_id
       INNER JOIN categories c ON p.category_id = c.id
       ORDER BY p.created_at DESC`
    );

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete Product (Admin)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM products WHERE id = $1', [id]);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All Orders
const getAllOrders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM orders o
       INNER JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );

    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin Dashboard Stats
const getAdminDashboard = async (req, res) => {
  try {
    // Get total users
    const usersResult = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'user'"
    );

    // Get total bakers
    const bakersResult = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'baker'"
    );

    // Get pending verifications
    const pendingResult = await db.query(
      "SELECT COUNT(*) as count FROM baker_profiles WHERE verification_status = 'pending'"
    );

    // Get total orders
    const ordersResult = await db.query(
      'SELECT COUNT(*) as count FROM orders'
    );

    // Get total revenue
    const revenueResult = await db.query(
      'SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE payment_status = $1',
      ['completed']
    );

    // SALES DATA FOR CHARTS
    // Weekly sales (last 7 days) - all orders
    const weeklySalesResult = await db.query(
      `SELECT
         EXTRACT(DOW FROM created_at) as day_of_week,
         DATE_TRUNC('day', created_at) as date,
         SUM(total_amount) as sales
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '7 days'
         AND payment_status = 'completed'
       GROUP BY date, day_of_week
       ORDER BY date`
    );

    // Format weekly sales
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklySales = weekDays.map(day => {
      const dayIndex = weekDays.indexOf(day);
      const found = weeklySalesResult.rows.find(r => parseInt(r.day_of_week) === dayIndex);
      return { period: day, sales: found ? parseFloat(found.sales) : 0 };
    });

    // Monthly sales (current year) - all orders
    const monthlySalesResult = await db.query(
      `SELECT
         EXTRACT(MONTH FROM created_at) as month,
         SUM(total_amount) as sales
       FROM orders
       WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
         AND payment_status = 'completed'
       GROUP BY month
       ORDER BY month`
    );

    // Format monthly sales
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySales = months.map((month, index) => {
      const found = monthlySalesResult.rows.find(r => parseInt(r.month) === index + 1);
      return { period: month, sales: found ? parseFloat(found.sales) : 0 };
    });

    // Yearly sales (last 5 years) - all orders
    const yearlySalesResult = await db.query(
      `SELECT
         EXTRACT(YEAR FROM created_at) as year,
         SUM(total_amount) as sales
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '5 years'
         AND payment_status = 'completed'
       GROUP BY year
       ORDER BY year`
    );

    // Format yearly sales
    const currentYear = new Date().getFullYear();
    const yearlySales = [];
    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;
      const found = yearlySalesResult.rows.find(r => parseInt(r.year) === year);
      yearlySales.push({ period: year.toString(), sales: found ? parseFloat(found.sales) : 0 });
    }

    res.json({
      total_users: parseInt(usersResult.rows[0].count),
      total_bakers: parseInt(bakersResult.rows[0].count),
      pending_verifications: parseInt(pendingResult.rows[0].count),
      total_orders: parseInt(ordersResult.rows[0].count),
      total_revenue: parseFloat(revenueResult.rows[0].revenue),
      sales_data: {
        weekly: weeklySales,
        monthly: monthlySales,
        yearly: yearlySales
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
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
};
