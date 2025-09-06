// Controllers index file
// Import and export your controllers here
const authController = require('./authController');
const menuController = require('./menuController');
const orderController = require('./orderController');

module.exports = {
  authController,
  menuController,
  orderController
};