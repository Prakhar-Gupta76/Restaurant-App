const { z } = require('zod');
const mongoose = require('mongoose');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Validation schema for order items
const orderItemSchema = z.object({
  menuItemId: z.string().refine(isValidObjectId, {
    message: 'Invalid menu item ID format'
  }),
  qty: z.number().int().positive().min(1, 'Quantity must be at least 1')
});

// Validation schema for creating a new order
const createOrderSchema = z.object({
  items: z.array(orderItemSchema)
    .nonempty('Order must contain at least one item')
});

// Validation schema for updating order status
const updateOrderStatusSchema = z.object({
  status: z.enum(['PLACED', 'PREPARING', 'READY', 'COMPLETED'], {
    errorMap: () => ({ message: 'Status must be one of: PLACED, PREPARING, READY, COMPLETED' })
  })
});

// Validation for pagination and filtering
const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['PLACED', 'PREPARING', 'READY', 'COMPLETED']).optional()
});

module.exports = {
  createOrderSchema,
  updateOrderStatusSchema,
  orderQuerySchema
};