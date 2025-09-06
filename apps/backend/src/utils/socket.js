/**
 * Socket.IO utility functions for emitting events
 */

let io;

/**
 * Initialize the Socket.IO instance
 * @param {Object} socketIo - The Socket.IO server instance
 */
const initialize = (socketIo) => {
  io = socketIo;
};

/**
 * Emit an event to the admin room
 * @param {string} event - The event name
 * @param {Object} data - The data to emit
 */
const emitToAdmin = (event, data) => {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  io.of('/orders').to('admin-board').emit(event, data);
};

/**
 * Emit an event to a specific order room
 * @param {string} orderId - The order ID
 * @param {string} event - The event name
 * @param {Object} data - The data to emit
 */
const emitToOrder = (orderId, event, data) => {
  if (!io) {
    console.error('Socket.IO not initialized');
    return;
  }
  
  io.of('/orders').to(orderId).emit(event, data);
};

module.exports = {
  initialize,
  emitToAdmin,
  emitToOrder
};