const { initializeOrderSocket } = require('./orderSocket');

/**
 * Initialize all Socket.IO namespaces
 * @param {Object} io - Socket.IO server instance
 */
const initializeSockets = (io) => {
  // Initialize order socket namespace
  const orderNamespace = initializeOrderSocket(io);
  
  return {
    orders: orderNamespace
  };
};

module.exports = {
  initializeSockets
};