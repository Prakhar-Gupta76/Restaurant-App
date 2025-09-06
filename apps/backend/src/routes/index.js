// Routes index file
const express = require('express');
const router = express.Router();

// Define your routes here
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;