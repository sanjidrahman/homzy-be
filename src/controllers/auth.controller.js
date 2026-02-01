const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// User Signup
const signup = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate UUID
    const userId = uuidv4();

    // Insert user
    await db.query(
      'INSERT INTO users (id, name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, name, email, hashedPassword, phone, 'user']
    );

    // Insert address if provided
    if (address) {
      const addressId = uuidv4();
      await db.query(
        'INSERT INTO addresses (id, user_id, street, city, state, pincode) VALUES ($1, $2, $3, $4, $5, $6)',
        [addressId, userId, address.street, address.city, address.state, address.pincode]
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, email, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: userId, name, email, role: 'user' }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login (All Roles)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if baker is verified
    if (user.role === 'baker' && !user.is_verified) {
      return res.status(403).json({ error: 'Baker account not verified' });
    }

    // Check if user is blocked
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, phone, role, is_verified, status, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update Profile
const updateProfile = async (req, res) => {
  try {
    const { id: _id, email: _email, role: _role, is_verified: _isVerified, status: _status, created_at: _createdAt, ...allowedUpdates } = req.body;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(allowedUpdates)) {
      updates.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }

    values.push(req.user.id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, phone, role, is_verified, status, created_at
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { signup, login, getProfile, updateProfile };
