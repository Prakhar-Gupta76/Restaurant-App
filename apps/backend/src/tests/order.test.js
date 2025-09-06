const request = require('supertest');
const express = require('express');
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');
const { socket } = require('../utils');

// Mock the socket utilities
jest.mock('../utils/socket', () => ({
  emitToAdmin: jest.fn(),
  emitToOrder: jest.fn(),
  initialize: jest.fn()
}));

// Mock the auth middleware
jest.mock('../middlewares/authMiddleware', () => ({
  requireAuth: jest.fn((req, res, next) => {
    req.user = { id: 'user-id', email: 'user@example.com', role: 'customer' };
    next();
  }),
  requireAdmin: jest.fn((req, res, next) => {
    req.user = { id: 'admin-id', email: 'admin@example.com', role: 'admin' };
    next();
  }),
}));

// Mock the Order model
const mockOrder = {
  _id: 'order-id',
  id: 'order-id',
  user: 'user-id',
  items: [
    {
      menuItemId: 'menu-item-id',
      nameSnapshot: 'Test Pizza',
      priceSnapshot: 12.99,
      qty: 2
    }
  ],
  subtotal: 25.98,
  tax: 2.60,
  total: 28.58,
  status: 'PLACED',
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(true)
};

const mockOrders = [
  mockOrder,
  {
    _id: 'order-id-2',
    id: 'order-id-2',
    user: 'user-id',
    items: [
      {
        menuItemId: 'menu-item-id-2',
        nameSnapshot: 'Test Pasta',
        priceSnapshot: 10.99,
        qty: 1
      }
    ],
    subtotal: 10.99,
    tax: 1.10,
    total: 12.09,
    status: 'COMPLETED',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Mock the MenuItem model
const mockMenuItems = [
  {
    _id: 'menu-item-id',
    id: 'menu-item-id',
    name: 'Test Pizza',
    price: 12.99,
    available: true
  },
  {
    _id: 'menu-item-id-2',
    id: 'menu-item-id-2',
    name: 'Test Pasta',
    price: 10.99,
    available: true
  }
];

// Mock the models
jest.mock('../models', () => ({
  Order: {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  },
  MenuItem: {
    find: jest.fn(),
  }
}));

// Create Express app for testing
const app = express();
app.use(express.json());

// Setup routes for testing
app.post('/api/orders', authMiddleware.requireAuth, orderController.createOrder);
app.get('/api/orders/:id', authMiddleware.requireAuth, orderController.getOrderById);
app.get('/api/orders/user', authMiddleware.requireAuth, orderController.getUserOrders);
app.get('/api/orders', authMiddleware.requireAdmin, orderController.getAllOrders);
app.put('/api/orders/:id/status', authMiddleware.requireAdmin, orderController.updateOrderStatus);

describe('Order Controller', () => {
  let models;
  
  beforeEach(() => {
    jest.clearAllMocks();
    models = require('../models');
  });
  
  describe('POST /api/orders', () => {
    it('should create a new order successfully', async () => {
      // Mock MenuItem.find to return menu items
      models.MenuItem.find.mockResolvedValue(mockMenuItems);
      
      // Mock Order.create to return a new order
      models.Order.create.mockResolvedValue(mockOrder);
      
      const response = await request(app)
        .post('/api/orders')
        .send({
          items: [
            { menuItemId: 'menu-item-id', qty: 2 }
          ]
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockOrder);
      expect(models.MenuItem.find).toHaveBeenCalled();
      expect(models.Order.create).toHaveBeenCalled();
      expect(socket.emitToAdmin).toHaveBeenCalledWith('newOrder', expect.any(Object));
    });
    
    it('should return 400 if menu items are not available', async () => {
      // Mock MenuItem.find to return empty array (no items found)
      models.MenuItem.find.mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/orders')
        .send({
          items: [
            { menuItemId: 'non-existent-id', qty: 2 }
          ]
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('unavailable');
    });
    
    it('should return 400 for validation errors', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          items: [] // Empty items array should fail validation
        });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation error');
    });
  });
  
  describe('GET /api/orders/:id', () => {
    it('should return an order by ID', async () => {
      // Mock findById to return an order
      models.Order.findById.mockResolvedValue(mockOrder);
      
      const response = await request(app)
        .get('/api/orders/order-id');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockOrder);
    });
    
    it('should return 404 if order not found', async () => {
      // Mock findById to return null
      models.Order.findById.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/orders/non-existent-id');
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Order not found');
    });
  });
  
  describe('PUT /api/orders/:id/status', () => {
    it('should update order status successfully', async () => {
      // Create a copy of mockOrder with status PLACED
      const orderToUpdate = { ...mockOrder, status: 'PLACED' };
      
      // Mock findById to return the order
      models.Order.findById.mockResolvedValue(orderToUpdate);
      
      const response = await request(app)
        .put('/api/orders/order-id/status')
        .send({ status: 'PREPARING' });
      
      expect(response.status).toBe(200);
      expect(orderToUpdate.status).toBe('PREPARING');
      expect(orderToUpdate.save).toHaveBeenCalled();
      expect(socket.emitToOrder).toHaveBeenCalledWith('order-id', 'orderUpdated', expect.any(Object));
    });
    
    it('should return 400 for invalid status transition', async () => {
      // Create a copy of mockOrder with status COMPLETED
      const orderToUpdate = { ...mockOrder, status: 'COMPLETED' };
      
      // Mock findById to return the order
      models.Order.findById.mockResolvedValue(orderToUpdate);
      
      const response = await request(app)
        .put('/api/orders/order-id/status')
        .send({ status: 'PLACED' });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Cannot change status');
      expect(orderToUpdate.save).not.toHaveBeenCalled();
    });
    
    it('should return 404 if order not found', async () => {
      // Mock findById to return null
      models.Order.findById.mockResolvedValue(null);
      
      const response = await request(app)
        .put('/api/orders/non-existent-id/status')
        .send({ status: 'PREPARING' });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Order not found');
    });
  });
});