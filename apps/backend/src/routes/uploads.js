const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middlewares/authMiddleware');
const { uploadImage, uploadMiddleware, uploadErrorHandler } = require('../controllers/uploadController');

// Upload image route (admin only)
router.post('/', 
  requireAdmin,
  uploadMiddleware,
  uploadErrorHandler,
  uploadImage
);

module.exports = router;
