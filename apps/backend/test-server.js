const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const morgan = require('morgan');
const path = require('path');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined')); // HTTP request logging

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic route
app.get('/', (req, res) => {
  res.send('Restaurant API Server Running');
});

// API Routes
const routes = require('./src/routes');
app.use('/api', routes);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('A user connected to main namespace:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected from main namespace:', socket.id);
  });
});

// Initialize Socket.IO namespaces (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  const { initializeSockets } = require('./src/socket');
  const sockets = initializeSockets(io);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Export for testing purposes
module.exports = { app, server, io };

