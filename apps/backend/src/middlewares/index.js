// Middlewares index file
const authMiddleware = require('./authMiddleware');

module.exports = {
  ...authMiddleware
};