const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { signup, login, getProfile, updateProfile } = require('../controllers/auth.controller');

// User Signup
router.post('/signup', signup);

// Login (All Roles)
router.post('/login', login);

// Get Profile
router.get('/profile', authMiddleware, getProfile);

// Update Profile
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
