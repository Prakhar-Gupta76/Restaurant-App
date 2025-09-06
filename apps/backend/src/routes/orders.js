const express = require('express');
const router = express.Router();
const { orderController } = require('../controllers');
const { requireAuth, requireAdmin } = require('../middlewares');

/**
 * @route POST /api/orders
 * @desc Create a new order
 * @access Private (Customer)
 */
router.post('/', requireAuth, orderController.createOrder);

/**
 * @route GET /api/orders/:id
 * @desc Get a single order by ID
 * @access Private (Order owner or Admin)
 */
router.get('/:id', requireAuth, orderController.getOrderById);

/**
 * @route GET /api/orders/user
 * @desc Get all orders for the current user
 * @access Private (Customer)
 */
router.get('/user', requireAuth, orderController.getUserOrders);

/**
 * @route GET /api/orders
 * @desc Get all orders (admin only)
 * @access Private (Admin only)
 */
router.get('/', requireAdmin, orderController.getAllOrders);

/**
 * @route PUT /api/orders/:id/status
 * @desc Update order status (admin only)
 * @access Private (Admin only)
 */
router.put('/:id/status', requireAdmin, orderController.updateOrderStatus);

module.exports = router;