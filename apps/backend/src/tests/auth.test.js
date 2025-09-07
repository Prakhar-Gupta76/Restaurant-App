const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { app } = require('../../test-server');
const { User } = require('../models');

describe('Auth Flow Tests', () => {
  let testUser;

  beforeEach(async () => {
    // Clear any existing test data
    await User.deleteMany({});
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('customer');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Verify user was created in database
      const createdUser = await User.findOne({ email: userData.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser.name).toBe(userData.name);
    });

    it('should return 409 if email already exists', async () => {
      // Create a user first
      const existingUser = await User.create({
        name: 'Existing User',
        email: 'existing@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'customer'
      });

      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'New User',
          email: 'existing@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Email already registered');
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
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'customer'
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Check for refresh token cookie
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('refreshToken=');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 400 for invalid input data', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: '' // Empty password
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation error');
    });
  });

  describe('POST /api/auth/refresh', () => {
    beforeEach(async () => {
      // Create a test user
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'customer'
      });
    });

    it('should refresh token successfully with valid refresh token', async () => {
      // First login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const refreshTokenCookie = loginResponse.headers['set-cookie'][0];

      // Use refresh token to get new access token
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('should return 401 without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Refresh token not found');
    });

    it('should return 401 with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid or expired refresh token');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
      
      // Check that refresh token cookie is cleared
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('refreshToken=;');
    });
  });
});