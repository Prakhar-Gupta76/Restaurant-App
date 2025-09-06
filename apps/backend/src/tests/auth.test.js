const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cookieParser = require('cookie-parser');

// Mock User model
const mockUser = {
  id: '60d21b4667d0d8992e610c85',
  name: 'Test User',
  email: 'test@example.com',
  password: '$2a$10$rrCvVWgC5WVC9lEtS27.6e0qlU7AaKVRYrC9.5n3ZVmjxEsMlVp6K', // hashed 'password123'
  role: 'customer',
  createdAt: new Date()
};

// Mock User model functions
jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn()
  }
}));

// Mock JWT functions
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-token'),
  verify: jest.fn()
}));

// Mock bcrypt functions
jest.mock('bcryptjs', () => ({
  genSalt: jest.fn(() => 'salt'),
  hash: jest.fn(() => 'hashed-password'),
  compare: jest.fn()
}));

// Import controllers after mocking dependencies
const authController = require('../controllers/authController');
const { User } = require('../models');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use(cookieParser());

// Mount auth routes for testing
app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/refresh', authController.refresh);
app.post('/api/auth/logout', authController.logout);

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user and return user data with token', async () => {
      // Mock User.findOne to return null (user doesn't exist)
      User.findOne.mockResolvedValue(null);
      
      // Mock User.create to return a new user
      User.create.mockResolvedValue({
        ...mockUser,
        toJSON: () => ({
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          createdAt: mockUser.createdAt
        })
      });

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('name', 'Test User');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.accessToken).toBe('mock-token');
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'customer'
      });
    });

    it('should return 409 if email already exists', async () => {
      // Mock User.findOne to return an existing user
      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', 'Email already registered');
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid input data', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'T', // Too short
          email: 'invalid-email',
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation error');
      expect(User.findOne).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user and return user data with tokens', async () => {
      // Mock User.findOne to return a user
      User.findOne.mockResolvedValue({
        ...mockUser,
        toJSON: () => ({
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          createdAt: mockUser.createdAt
        })
      });
      
      // Mock bcrypt.compare to return true
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.accessToken).toBe('mock-token');
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password);
      expect(jwt.sign).toHaveBeenCalledTimes(2); // Access token and refresh token
      
      // Check for refresh token cookie
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('refreshToken=mock-token');
    });

    it('should return 401 for non-existent user', async () => {
      // Mock User.findOne to return null
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid password', async () => {
      // Mock User.findOne to return a user
      User.findOne.mockResolvedValue(mockUser);
      
      // Mock bcrypt.compare to return false
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', mockUser.password);
    });
  });
});