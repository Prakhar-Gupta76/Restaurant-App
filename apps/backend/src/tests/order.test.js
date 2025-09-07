const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { app } = require('../../test-server');
const { User, MenuItem, Order } = require('../models');

// Mock socket utility
jest.mock('../utils/socket', () => ({
  socket: {
    emitToAdmin: jest.fn(),
    emitToOrder: jest.fn()
  }
}));

describe('Order Tests', () => {
  let adminUser;
  let customerUser;
  let adminToken;
  let customerToken;
  let menuItems;

  beforeEach(async () => {
    // Clear existing data
    await User.deleteMany({});
    await MenuItem.deleteMany({});
    await Order.deleteMany({});

    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'admin'
    });

    // Create customer user
    customerUser = await User.create({
      name: 'Customer User',
      email: 'customer@example.com',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'customer'
    });

    // Generate tokens
    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_ACCESS_SECRET || 'test-secret',
      { expiresIn: '15m' }
    );

    customerToken = jwt.sign(
      { id: customerUser.id, email: customerUser.email, role: customerUser.role },
      process.env.JWT_ACCESS_SECRET || 'test-secret',
      { expiresIn: '15m' }
    );

    // Create sample menu items
    menuItems = await MenuItem.create([
      {
        name: 'Margherita Pizza',
        description: 'Classic pizza with tomato sauce and mozzarella',
        price: 16.99,
        category: 'Pizza',
        available: true
      },
      {
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with caesar dressing',
        price: 8.99,
        category: 'Salad',
        available: true
      },
      {
        name: 'Unavailable Item',
        description: 'This item is not available',
        price: 5.99,
        category: 'Appetizer',
        available: false
      }
    ]);
  });

  describe('POST /api/orders', () => {
    it('should create a new order as customer', async () => {
      const orderData = {
        items: [
          {
            menuItemId: menuItems[0].id,
            qty: 2
          },
          {
            menuItemId: menuItems[1].id,
            qty: 1
          }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.user).toBe(customerUser.id);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.status).toBe('PLACED');
      expect(response.body.subtotal).toBe(42.97); // (16.99 * 2) + (8.99 * 1)
      expect(response.body.tax).toBe(4.30); // 10% of subtotal
      expect(response.body.total).toBe(47.27); // subtotal + tax

      // Verify order was created in database
      const createdOrder = await Order.findById(response.body.id);
      expect(createdOrder).toBeTruthy();
      expect(createdOrder.items[0].nameSnapshot).toBe('Margherita Pizza');
      expect(createdOrder.items[0].priceSnapshot).toBe(16.99);
    });

    it('should return 400 for unavailable menu items', async () => {
      const orderData = {
        items: [
          {
            menuItemId: menuItems[2].id, // Unavailable item
            qty: 1
          }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.message).toBe('One or more menu items are unavailable or do not exist');
    });

    it('should return 400 for non-existent menu items', async () => {
      const orderData = {
        items: [
          {
            menuItemId: '507f1f77bcf86cd799439011', // Non-existent ID
            qty: 1
          }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.message).toBe('One or more menu items are unavailable or do not exist');
    });

    it('should return 401 without authentication', async () => {
      const orderData = {
        items: [
          {
            menuItemId: menuItems[0].id,
            qty: 1
          }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('should return 400 for invalid input data', async () => {
      const invalidData = {
        items: [
          {
            menuItemId: menuItems[0].id,
            qty: 0 // Invalid quantity
          }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Validation error');
    });
  });

  describe('GET /api/orders/user', () => {
    let customerOrder;

    beforeEach(async () => {
      // Create an order for the customer
      customerOrder = await Order.create({
        user: customerUser.id,
        items: [
          {
            menuItemId: menuItems[0].id,
            nameSnapshot: 'Margherita Pizza',
            priceSnapshot: 16.99,
            qty: 1
          }
        ],
        subtotal: 16.99,
        tax: 1.70,
        total: 18.69,
        status: 'PLACED'
      });
    });

    it('should get user orders with pagination', async () => {
      const response = await request(app)
        .get('/api/orders/user')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.orders).toHaveLength(1);
      expect(response.body.orders[0].id).toBe(customerOrder.id);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/orders/user')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });
  });

  describe('GET /api/orders/:id', () => {
    let customerOrder;

    beforeEach(async () => {
      // Create an order for the customer
      customerOrder = await Order.create({
        user: customerUser.id,
        items: [
          {
            menuItemId: menuItems[0].id,
            nameSnapshot: 'Margherita Pizza',
            priceSnapshot: 16.99,
            qty: 1
          }
        ],
        subtotal: 16.99,
        tax: 1.70,
        total: 18.69,
        status: 'PLACED'
      });
    });

    it('should get order details for order owner', async () => {
      const response = await request(app)
        .get(`/api/orders/${customerOrder.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.id).toBe(customerOrder.id);
      expect(response.body.user).toBe(customerUser.id);
      expect(response.body.status).toBe('PLACED');
    });

    it('should get order details for admin', async () => {
      const response = await request(app)
        .get(`/api/orders/${customerOrder.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(customerOrder.id);
      expect(response.body.user).toBe(customerUser.id);
    });

    it('should return 403 for unauthorized access', async () => {
      // Create another customer
      const anotherCustomer = await User.create({
        name: 'Another Customer',
        email: 'another@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'customer'
      });

      const anotherToken = jwt.sign(
        { id: anotherCustomer.id, email: anotherCustomer.email, role: anotherCustomer.role },
        process.env.JWT_ACCESS_SECRET || 'test-secret',
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .get(`/api/orders/${customerOrder.id}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(403);

      expect(response.body.message).toBe('Not authorized to view this order');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);

      expect(response.body.message).toBe('Order not found');
    });
  });

  describe('GET /api/orders (admin)', () => {
    let customerOrder;

    beforeEach(async () => {
      // Create an order for the customer
      customerOrder = await Order.create({
        user: customerUser.id,
        items: [
          {
            menuItemId: menuItems[0].id,
            nameSnapshot: 'Margherita Pizza',
            priceSnapshot: 16.99,
            qty: 1
          }
        ],
        subtotal: 16.99,
        tax: 1.70,
        total: 18.69,
        status: 'PLACED'
      });
    });

    it('should get all orders as admin', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.orders).toHaveLength(1);
      expect(response.body.orders[0].id).toBe(customerOrder.id);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=PLACED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.orders).toHaveLength(1);
      expect(response.body.orders[0].status).toBe('PLACED');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: Admin privileges required');
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    let customerOrder;

    beforeEach(async () => {
      // Create an order for the customer
      customerOrder = await Order.create({
        user: customerUser.id,
        items: [
          {
            menuItemId: menuItems[0].id,
            nameSnapshot: 'Margherita Pizza',
            priceSnapshot: 16.99,
            qty: 1
          }
        ],
        subtotal: 16.99,
        tax: 1.70,
        total: 18.69,
        status: 'PLACED'
      });
    });

    it('should update order status as admin', async () => {
      const updateData = {
        status: 'PREPARING'
      };

      const response = await request(app)
        .put(`/api/orders/${customerOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Order status updated to PREPARING');
      expect(response.body.order.status).toBe('PREPARING');

      // Verify status was updated in database
      const updatedOrder = await Order.findById(customerOrder.id);
      expect(updatedOrder.status).toBe('PREPARING');
    });

    it('should not allow invalid status transitions', async () => {
      // First update to PREPARING
      customerOrder.status = 'PREPARING';
      await customerOrder.save();

      const updateData = {
        status: 'PLACED' // Cannot go backwards
      };

      const response = await request(app)
        .put(`/api/orders/${customerOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toBe('Cannot change status from PREPARING to PLACED');
    });

    it('should return 404 for non-existent order', async () => {
      const updateData = {
        status: 'PREPARING'
      };

      const response = await request(app)
        .put('/api/orders/507f1f77bcf86cd799439011/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.message).toBe('Order not found');
    });

    it('should return 403 for non-admin users', async () => {
      const updateData = {
        status: 'PREPARING'
      };

      const response = await request(app)
        .put(`/api/orders/${customerOrder.id}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.message).toBe('Access denied: Admin privileges required');
    });

    it('should return 400 for invalid status', async () => {
      const updateData = {
        status: 'INVALID_STATUS'
      };

      const response = await request(app)
        .put(`/api/orders/${customerOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Validation error');
    });
  });
});