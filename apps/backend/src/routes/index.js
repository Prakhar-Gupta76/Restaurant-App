// Routes index file
const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const menuRoutes = require('./menu');
const orderRoutes = require('./orders');

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);

module.exports = router;