import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database and models
import { sequelize } from './models/index.js';

// Import routes
import authRoutes from './routes/auth.js';
import listingsRoutes from './routes/listings.js';
import bidsRoutes from './routes/bids.js';
import walletRoutes from './routes/wallet.js';
import chatRoutes from './routes/chat.js';
import notificationsRoutes from './routes/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io accessible in routes
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/bids', bidsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'KARGA CONNECT API is running',
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'KARGA CONNECT API',
    version: '1.0.0',
    description: 'Philippine Trucking Backload Marketplace',
    endpoints: {
      auth: '/api/auth',
      listings: '/api/listings',
      bids: '/api/bids',
      wallet: '/api/wallet',
      chat: '/api/chat',
      notifications: '/api/notifications',
    },
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join user-specific room
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Join listing room for real-time bid updates
  socket.on('join-listing', (listingId) => {
    socket.join(`listing:${listingId}`);
    console.log(`Socket joined listing room: ${listingId}`);
  });

  // Leave listing room
  socket.on('leave-listing', (listingId) => {
    socket.leave(`listing:${listingId}`);
  });

  // Handle new bid (broadcast to listing room)
  socket.on('new-bid', (data) => {
    io.to(`listing:${data.listingId}`).emit('bid-received', data);
  });

  // Handle new chat message
  socket.on('chat-message', (data) => {
    io.to(`user:${data.recipientId}`).emit('new-message', data);
  });

  // Handle shipment update
  socket.on('shipment-update', (data) => {
    io.to(`user:${data.shipperId}`).emit('tracking-update', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Sync database (creates tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log('Database synchronized');

    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   KARGA CONNECT API Server                        ║
║   Running on http://localhost:${PORT}              ║
║                                                   ║
║   Endpoints:                                      ║
║   - Auth:          /api/auth                      ║
║   - Listings:      /api/listings                  ║
║   - Bids:          /api/bids                      ║
║   - Wallet:        /api/wallet                    ║
║   - Chat:          /api/chat                      ║
║   - Notifications: /api/notifications             ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };
