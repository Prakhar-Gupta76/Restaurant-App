const path = require('path');
const { uploadSingle, handleUploadError } = require('../utils/upload');

/**
 * Upload image file
 * @route POST /api/uploads
 * @access Private (Admin only)
 */
exports.uploadImage = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No image file provided. Please upload an image.' 
      });
    }

    // Generate accessible URL
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;

    res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ 
      message: 'Server error while uploading image' 
    });
  }
};

// Export multer middleware and error handler
exports.uploadMiddleware = uploadSingle;
exports.uploadErrorHandler = handleUploadError;
