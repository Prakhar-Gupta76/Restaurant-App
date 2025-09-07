const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { app } = require('../../test-server');
const { User, MenuItem } = require('../models');

describe('Menu Tests', () => {
  let adminUser;
  let customerUser;
  let adminToken;
  let customerToken;

  beforeEach(async () => {
    // Clear existing data
    await User.deleteMany({});
    await MenuItem.deleteMany({});

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
  });

  describe('GET /api/menu', () => {
    beforeEach(async () => {
      // Create sample menu items
      await MenuItem.create([
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
          name: 'Chocolate Cake',
          description: 'Rich chocolate layer cake',
          price: 7.99,
          category: 'Dessert',
          available: false
        }
      ]);
    });

    it('should get all menu items with pagination', async () => {
      const response = await request(app)
        .get('/api/menu')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should filter menu items by category', async () => {
      const response = await request(app)
        .get('/api/menu?category=Pizza')
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].category).toBe('Pizza');
    });

    it('should search menu items by name and description', async () => {
      const response = await request(app)
        .get('/api/menu?q=chocolate')
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toContain('Chocolate');
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/menu?page=1&limit=2')
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.pages).toBe(2);
    });
  });

  describe('GET /api/menu/:id', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await MenuItem.create({
        name: 'Test Pizza',
        description: 'Test description',
        price: 15.99,
        category: 'Pizza',
        available: true
      });
    });

    it('should get a single menu item by ID', async () => {
      const response = await request(app)
        .get(`/api/menu/${menuItem.id}`)
        .expect(200);

      expect(response.body.name).toBe('Test Pizza');
      expect(response.body.price).toBe(15.99);
    });

    it('should return 404 for non-existent menu item', async () => {
      const response = await request(app)
        .get('/api/menu/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.message).toBe('Menu item not found');
    });
  });

  describe('POST /api/menu', () => {
    it('should create a new menu item as admin', async () => {
      const menuData = {
        name: 'New Pizza',
        description: 'A delicious new pizza',
        price: 18.99,
        category: 'Pizza',
        imageUrl: 'https://example.com/image.jpg',
        available: true
      };

      const response = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(menuData)
        .expect(201);

      expect(response.body.name).toBe(menuData.name);
      expect(response.body.price).toBe(menuData.price);
      expect(response.body.category).toBe(menuData.category);

      // Verify item was created in database
      const createdItem = await MenuItem.findById(response.body.id);
      expect(createdItem).toBeTruthy();
    });

    it('should return 403 for non-admin users', async () => {
      const menuData = {
        name: 'New Pizza',
        description: 'A delicious new pizza',
        price: 18.99,
        category: 'Pizza'
      };

      const response = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(menuData)
        .expect(403);

      expect(response.body.message).toBe('Access denied: Admin privileges required');
    });

    it('should return 401 without authentication', async () => {
      const menuData = {
        name: 'New Pizza',
        description: 'A delicious new pizza',
        price: 18.99,
        category: 'Pizza'
      };

      const response = await request(app)
        .post('/api/menu')
        .send(menuData)
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('should return 400 for invalid input data', async () => {
      const invalidData = {
        name: 'A', // Too short
        description: 'Short', // Too short
        price: -5, // Negative price
        category: 'X' // Too short
      };

      const response = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Validation error');
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('PUT /api/menu/:id', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await MenuItem.create({
        name: 'Original Pizza',
        description: 'Original description',
        price: 15.99,
        category: 'Pizza',
        available: true
      });
    });

    it('should update menu item as admin', async () => {
      const updateData = {
        name: 'Updated Pizza',
        description: 'Updated description',
        price: 19.99,
        category: 'Pizza',
        available: false
      };

      const response = await request(app)
        .put(`/api/menu/${menuItem.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Pizza');
      expect(response.body.price).toBe(19.99);
      expect(response.body.available).toBe(false);

      // Verify item was updated in database
      const updatedItem = await MenuItem.findById(menuItem.id);
      expect(updatedItem.name).toBe('Updated Pizza');
    });

    it('should return 404 for non-existent menu item', async () => {
      const updateData = {
        name: 'Updated Pizza',
        description: 'Updated description',
        price: 19.99,
        category: 'Pizza'
      };

      const response = await request(app)
        .put('/api/menu/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.message).toBe('Menu item not found');
    });

    it('should return 403 for non-admin users', async () => {
      const updateData = {
        name: 'Updated Pizza',
        description: 'Updated description',
        price: 19.99,
        category: 'Pizza'
      };

      const response = await request(app)
        .put(`/api/menu/${menuItem.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.message).toBe('Access denied: Admin privileges required');
    });
  });

  describe('DELETE /api/menu/:id', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await MenuItem.create({
        name: 'Pizza to Delete',
        description: 'This pizza will be deleted',
        price: 15.99,
        category: 'Pizza',
        available: true
      });
    });

    it('should delete menu item as admin', async () => {
      const response = await request(app)
        .delete(`/api/menu/${menuItem.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Menu item deleted successfully');

      // Verify item was deleted from database
      const deletedItem = await MenuItem.findById(menuItem.id);
      expect(deletedItem).toBeNull();
    });

    it('should return 404 for non-existent menu item', async () => {
      const response = await request(app)
        .delete('/api/menu/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.message).toBe('Menu item not found');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete(`/api/menu/${menuItem.id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: Admin privileges required');
    });
  });

  describe('PATCH /api/menu/:id/toggle', () => {
    let menuItem;

    beforeEach(async () => {
      menuItem = await MenuItem.create({
        name: 'Toggle Pizza',
        description: 'This pizza will be toggled',
        price: 15.99,
        category: 'Pizza',
        available: true
      });
    });

    it('should toggle menu item availability as admin', async () => {
      const response = await request(app)
        .patch(`/api/menu/${menuItem.id}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Menu item is now unavailable');
      expect(response.body.available).toBe(false);

      // Verify availability was toggled in database
      const toggledItem = await MenuItem.findById(menuItem.id);
      expect(toggledItem.available).toBe(false);
    });

    it('should toggle from unavailable to available', async () => {
      // First make it unavailable
      menuItem.available = false;
      await menuItem.save();

      const response = await request(app)
        .patch(`/api/menu/${menuItem.id}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Menu item is now available');
      expect(response.body.available).toBe(true);
    });

    it('should return 404 for non-existent menu item', async () => {
      const response = await request(app)
        .patch('/api/menu/507f1f77bcf86cd799439011/toggle')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.message).toBe('Menu item not found');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .patch(`/api/menu/${menuItem.id}/toggle`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied: Admin privileges required');
    });
  });
});