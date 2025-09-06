const { z } = require('zod');
const { Order, MenuItem } = require('../models');
const { socket } = require('../utils');
const { createOrderSchema, updateOrderStatusSchema, orderQuerySchema } = require('../models/validation/orderValidation');

/**
 * Create a new order
 * @route POST /api/orders
 * @access Private (Customer)
 */
exports.createOrder = async (req, res) => {
  try {
    // Validate request body
    const validatedData = createOrderSchema.parse(req.body);
    
    // Get menu items by IDs and ensure they exist and are available
    const menuItemIds = validatedData.items.map(item => item.menuItemId);
    const menuItems = await MenuItem.find({ 
      _id: { $in: menuItemIds },
      available: true
    });
    
    // Check if all menu items were found and are available
    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ 
        message: 'One or more menu items are unavailable or do not exist' 
      });
    }
    
    // Create a map of menu items for easy lookup
    const menuItemsMap = menuItems.reduce((map, item) => {
      map[item._id.toString()] = item;
      return map;
    }, {});
    
    // Build order items with snapshots
    const orderItems = validatedData.items.map(item => {
      const menuItem = menuItemsMap[item.menuItemId];
      return {
        menuItemId: item.menuItemId,
        nameSnapshot: menuItem.name,
        priceSnapshot: menuItem.price,
        qty: item.qty
      };
    });
    
    // Calculate totals
    const subtotal = orderItems.reduce(
      (sum, item) => sum + (item.priceSnapshot * item.qty), 
      0
    );
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;
    
    // Create the order
    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      subtotal,
      tax,
      total,
      status: 'PLACED'
    });
    
    // Emit socket event for new order
    socket.emitToAdmin('newOrder', {
      orderId: order.id,
      total: order.total,
      createdAt: order.createdAt
    });
    
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error while creating order' });
  }
};

/**
 * Get a single order by ID
 * @route GET /api/orders/:id
 * @access Private (Order owner or Admin)
 */
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if user is authorized to view this order
    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Server error while fetching order' });
  }
};

/**
 * Get all orders for the current user
 * @route GET /api/orders/user
 * @access Private (Customer)
 */
exports.getUserOrders = async (req, res) => {
  try {
    // Parse query parameters
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Find orders for the current user
    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination
    const total = await Order.countDocuments({ user: req.user.id });
    
    res.json({
      orders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};

/**
 * Get all orders (admin only)
 * @route GET /api/orders
 * @access Private (Admin only)
 */
exports.getAllOrders = async (req, res) => {
  try {
    // Validate and parse query parameters
    const validatedQuery = orderQuerySchema.parse(req.query);
    const { page, limit, startDate, endDate, status } = validatedQuery;
    const skip = (page - 1) * limit;
    
    // Build query
    const query = {};
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }
    
    // Execute query with pagination
    const orders = await Order.find(query)
      .populate('user', 'email name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Order.countDocuments(query);
    
    res.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};

/**
 * Update order status (admin only)
 * @route PUT /api/orders/:id/status
 * @access Private (Admin only)
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    // Validate request body
    const validatedData = updateOrderStatusSchema.parse(req.body);
    
    // Find the order
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if the status transition is valid
    const statusOrder = ['PLACED', 'PREPARING', 'READY', 'COMPLETED'];
    const currentStatusIndex = statusOrder.indexOf(order.status);
    const newStatusIndex = statusOrder.indexOf(validatedData.status);
    
    // Cannot revert from a later status to an earlier one
    if (newStatusIndex < currentStatusIndex) {
      return res.status(400).json({ 
        message: `Cannot change status from ${order.status} to ${validatedData.status}` 
      });
    }
    
    // Update the order status
    order.status = validatedData.status;
    await order.save();
    
    // Emit socket event for order update
    socket.emitToOrder(order.id, 'orderUpdated', {
      orderId: order.id,
      status: order.status,
      updatedAt: new Date()
    });
    
    res.json({
      message: `Order status updated to ${order.status}`,
      order
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error while updating order status' });
  }
};