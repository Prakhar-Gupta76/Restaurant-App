const jwt = require('jsonwebtoken');

/**
 * Extract and verify JWT from Authorization header
 * Sets req.user = {id, email, role} if token is valid
 */
const verifyToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Set user info in request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    res.status(500).json({ message: 'Server error during authentication' });
  }
};

/**
 * Middleware to require authentication
 * Uses verifyToken and continues if successful
 */
const requireAuth = (req, res, next) => {
  verifyToken(req, res, next);
};

/**
 * Middleware to require admin role
 * First verifies token, then checks if user has admin role
 */
const requireAdmin = (req, res, next) => {
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admin privileges required' });
    }
    
    next();
  });
};

module.exports = {
  verifyToken,
  requireAuth,
  requireAdmin
};