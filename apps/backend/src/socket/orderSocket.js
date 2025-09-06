const jwt = require('jsonwebtoken');
const { socket } = require('../utils');

/**
 * Socket.IO authentication middleware for admin connections
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} next - Next function
 */
const adminAuthMiddleware = (socket, next) => {
  try {
    // Get token from handshake query
    const token = socket.handshake.query?.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Check if user has admin role
    if (decoded.role !== 'admin') {
      return next(new Error('Authentication error: Admin privileges required'));
    }
    
    // Set user info in socket object
    socket.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid or expired token'));
  }
};

/**
 * Initialize Socket.IO order namespace
 * @param {Object} io - Socket.IO server instance
 */
const initializeOrderSocket = (io) => {
  // Initialize socket utility with io instance
  socket.initialize(io);
  
  // Create orders namespace
  const ordersNamespace = io.of('/orders');
  
  // Connection handler
  ordersNamespace.on('connection', (socket) => {
    console.log('Client connected to orders namespace:', socket.id);
    
    // Handle customer joining order room
    socket.on('joinOrder', (orderId) => {
      if (!orderId) {
        socket.emit('error', { message: 'Order ID is required' });
        return;
      }
      
      socket.join(orderId);
      console.log(`Client ${socket.id} joined order room: ${orderId}`);
      socket.emit('joined', { orderId });
    });
    
    // Handle admin joining admin board
    socket.on('joinAdminBoard', async (token) => {
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        
        // Check if user has admin role
        if (decoded.role !== 'admin') {
          socket.emit('error', { message: 'Admin privileges required' });
          return;
        }
        
        socket.join('admin-board');
        console.log(`Admin ${socket.id} joined admin board`);
        socket.emit('joined', { room: 'admin-board' });
      } catch (error) {
        console.error('Admin authentication error:', error);
        socket.emit('error', { message: 'Invalid or expired token' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected from orders namespace:', socket.id);
    });
  });
  
  return ordersNamespace;
};

module.exports = {
  initializeOrderSocket,
  adminAuthMiddleware
};