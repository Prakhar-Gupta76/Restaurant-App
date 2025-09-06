const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authRateLimit } = require('../middlewares/rateLimiter');

/**
 * @route POST /api/auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post('/signup', authRateLimit, authController.signup);

/**
 * @route POST /api/auth/login
 * @desc Authenticate user & get tokens
 * @access Public
 */
router.post('/login', authRateLimit, authController.login);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route POST /api/auth/logout
 * @desc Logout user by clearing refresh token cookie
 * @access Public
 */
router.post('/logout', authController.logout);

module.exports = router;