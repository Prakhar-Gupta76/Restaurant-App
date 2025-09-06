// Routes index file
const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount routes
router.use('/auth', authRoutes);

module.exports = router;