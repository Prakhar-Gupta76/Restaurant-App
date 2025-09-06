const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { requireAuth, requireAdmin } = require('../middlewares');

/**
 * @route GET /api/menu
 * @desc Get menu items with search, filter, and pagination
 * @access Public
 */
router.get('/', menuController.getMenuItems);

/**
 * @route GET /api/menu/:id
 * @desc Get a single menu item by ID
 * @access Public
 */
router.get('/:id', menuController.getMenuItem);

/**
 * @route POST /api/menu
 * @desc Create a new menu item
 * @access Admin only
 */
router.post('/', requireAdmin, menuController.createMenuItem);

/**
 * @route PUT /api/menu/:id
 * @desc Update a menu item
 * @access Admin only
 */
router.put('/:id', requireAdmin, menuController.updateMenuItem);

/**
 * @route DELETE /api/menu/:id
 * @desc Delete a menu item
 * @access Admin only
 */
router.delete('/:id', requireAdmin, menuController.deleteMenuItem);

/**
 * @route PATCH /api/menu/:id/toggle
 * @desc Toggle menu item availability
 * @access Admin only
 */
router.patch('/:id/toggle', requireAdmin, menuController.toggleAvailability);

module.exports = router;