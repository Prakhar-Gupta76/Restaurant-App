const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const menuController = require('../controllers/menuController');
const authMiddleware = require('../middlewares/authMiddleware');

// Mock the auth middleware
jest.mock('../middlewares/authMiddleware', () => ({
  requireAuth: jest.fn((req, res, next) => next()),
  requireAdmin: jest.fn((req, res, next) => {
    req.user = { _id: 'admin-user-id', isAdmin: true };
    next();
  }),
}));

// Mock the MenuItem model
const mockMenuItem = {
  _id: 'menu-item-id',
  name: 'Test Pizza',
  description: 'A test pizza',
  price: 12.99,
  category: 'pizza',
  imageUrl: 'https://example.com/test-pizza.jpg',
  available: true,
};

const mockMenuItems = [
  mockMenuItem,
  {
    _id: 'menu-item-id-2',
    name: 'Test Pasta',
    description: 'A test pasta',
    price: 10.99,
    category: 'pasta',
    imageUrl: 'https://example.com/test-pasta.jpg',
    available: true,
  },
];

// Mock the MenuItem model
const mockMenuItemModel = {
  find: jest.fn().mockReturnThis(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  countDocuments: jest.fn(),
};

// Mock mongoose
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    model: jest.fn().mockImplementation(() => mockMenuItemModel),
    Schema: actualMongoose.Schema,
    Types: {
      ObjectId: {
        isValid: jest.fn().mockReturnValue(true),
      },
    },
  };
});

// Setup express app for testing
const app = express();
app.use(express.json());

// Setup routes for testing
app.get('/api/menu', menuController.getMenuItems);
app.get('/api/menu/:id', menuController.getMenuItem);
app.post('/api/menu', authMiddleware.requireAdmin, menuController.createMenuItem);
app.put('/api/menu/:id', authMiddleware.requireAdmin, menuController.updateMenuItem);
app.delete('/api/menu/:id', authMiddleware.requireAdmin, menuController.deleteMenuItem);
app.patch('/api/menu/:id/toggle', authMiddleware.requireAdmin, menuController.toggleAvailability);

describe('Menu Controller', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/menu', () => {
    it('should get all menu items with pagination', async () => {
      mockMenuItemModel.exec.mockResolvedValueOnce(mockMenuItems);
      mockMenuItemModel.countDocuments.mockResolvedValueOnce(2);

      const response = await request(app).get('/api/menu');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.items).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 12,
        pages: 1,
      });
    });

    it('should filter by category', async () => {
      mockMenuItemModel.exec.mockResolvedValueOnce([mockMenuItem]);
      mockMenuItemModel.countDocuments.mockResolvedValueOnce(1);

      const response = await request(app).get('/api/menu?category=pizza');

      expect(response.status).toBe(200);
      expect(mockMenuItemModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'pizza' })
      );
      expect(response.body.items).toHaveLength(1);
    });

    it('should search by query', async () => {
      mockMenuItemModel.exec.mockResolvedValueOnce([mockMenuItem]);
      mockMenuItemModel.countDocuments.mockResolvedValueOnce(1);

      const response = await request(app).get('/api/menu?q=pizza');

      expect(response.status).toBe(200);
      expect(mockMenuItemModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: expect.any(Object) },
            { description: expect.any(Object) },
          ],
        })
      );
      expect(response.body.items).toHaveLength(1);
    });
  });

  describe('GET /api/menu/:id', () => {
    it('should get a menu item by id', async () => {
      mockMenuItemModel.findById.mockResolvedValueOnce(mockMenuItem);

      const response = await request(app).get('/api/menu/menu-item-id');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMenuItem);
      expect(mockMenuItemModel.findById).toHaveBeenCalledWith('menu-item-id');
    });

    it('should return 404 if menu item not found', async () => {
      mockMenuItemModel.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/menu/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/menu', () => {
    it('should create a new menu item', async () => {
      mockMenuItemModel.create.mockResolvedValueOnce(mockMenuItem);

      const response = await request(app)
        .post('/api/menu')
        .send({
          name: 'Test Pizza',
          description: 'A test pizza',
          price: 12.99,
          category: 'pizza',
          imageUrl: 'https://example.com/test-pizza.jpg',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockMenuItem);
      expect(mockMenuItemModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Pizza',
          description: 'A test pizza',
          price: 12.99,
          category: 'pizza',
          imageUrl: 'https://example.com/test-pizza.jpg',
        })
      );
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/menu')
        .send({
          // Missing required fields
          description: 'A test pizza',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('PUT /api/menu/:id', () => {
    it('should update a menu item', async () => {
      mockMenuItemModel.findByIdAndUpdate.mockResolvedValueOnce({
        ...mockMenuItem,
        name: 'Updated Pizza',
      });

      const response = await request(app)
        .put('/api/menu/menu-item-id')
        .send({
          name: 'Updated Pizza',
          description: 'An updated pizza',
          price: 14.99,
          category: 'pizza',
          imageUrl: 'https://example.com/updated-pizza.jpg',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Pizza');
      expect(mockMenuItemModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'menu-item-id',
        expect.any(Object),
        { new: true }
      );
    });

    it('should return 404 if menu item not found', async () => {
      mockMenuItemModel.findByIdAndUpdate.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/menu/nonexistent-id')
        .send({
          name: 'Updated Pizza',
          description: 'An updated pizza',
          price: 14.99,
          category: 'pizza',
          imageUrl: 'https://example.com/updated-pizza.jpg',
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('DELETE /api/menu/:id', () => {
    it('should delete a menu item', async () => {
      mockMenuItemModel.findByIdAndDelete.mockResolvedValueOnce(mockMenuItem);

      const response = await request(app).delete('/api/menu/menu-item-id');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(mockMenuItemModel.findByIdAndDelete).toHaveBeenCalledWith('menu-item-id');
    });

    it('should return 404 if menu item not found', async () => {
      mockMenuItemModel.findByIdAndDelete.mockResolvedValueOnce(null);

      const response = await request(app).delete('/api/menu/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PATCH /api/menu/:id/toggle', () => {
    it('should toggle menu item availability', async () => {
      mockMenuItemModel.findById.mockResolvedValueOnce({
        ...mockMenuItem,
        available: true,
      });
      mockMenuItemModel.findByIdAndUpdate.mockResolvedValueOnce({
        ...mockMenuItem,
        available: false,
      });

      const response = await request(app).patch('/api/menu/menu-item-id/toggle');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('available', false);
      expect(mockMenuItemModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'menu-item-id',
        { available: false },
        { new: true }
      );
    });

    it('should return 404 if menu item not found', async () => {
      mockMenuItemModel.findById.mockResolvedValueOnce(null);

      const response = await request(app).patch('/api/menu/nonexistent-id/toggle');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });
  });
});