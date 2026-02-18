import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import listingsRoutes from './routes/listings.js';
import bidsRoutes from './routes/bids.js';
import walletRoutes from './routes/wallet.js';
import chatRoutes from './routes/chat.js';
import notificationsRoutes from './routes/notifications.js';
import contractsRoutes from './routes/contracts.js';
import ratingsRoutes from './routes/ratings.js';
import shipmentsRoutes from './routes/shipments.js';
import adminRoutes from './routes/admin.js';

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Preserve route compatibility for previous socket emit code paths.
const ioNoop = {
  to() {
    return {
      emit() {},
    };
  },
};
app.set('io', ioNoop);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/bids', bidsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/admin', adminRoutes);

// OpenRouteService proxy - avoids CORS restrictions when calling from browser
app.post('/api/route', async (req, res) => {
  const apiKey = process.env.OPENROUTE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Routing service not configured' });
  }

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (_error) {
    return res.status(502).json({ error: 'Failed to reach routing service' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'KARGA CONNECT API is running',
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get('/api', (_req, res) => {
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
      contracts: '/api/contracts',
      ratings: '/api/ratings',
      shipments: '/api/shipments',
      admin: '/api/admin',
    },
  });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
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

const PORT = process.env.PORT || 3001;

function startServer() {
  app.listen(PORT, () => {
    console.log(`KARGA CONNECT API Server running on http://localhost:${PORT}`);
  });
}

startServer();

export { app };
