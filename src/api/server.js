const express = require('express');
const cors = require('cors');
const http = require('http');
const wapRouter = require('./routes/wap.routes');
const cepRouter = require('./routes/cep.routes');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      wap: 'active',
      cep: 'active'
    }
  });
});

// API Routes
app.use('/api/wap', wapRouter);
app.use('/api/cep', cepRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Unified API Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      wap: {
        status: '/api/wap/status',
        checkSingle: '/api/wap/check',
        checkBatch: '/api/wap/check/batch'
      },
      cep: {
        validateGet: '/api/cep/validate/:cep',
        validatePost: '/api/cep/validate'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Create server
const server = http.createServer(app);

// Start server function
function startServer() {
  const port = config.port;
  
  server.listen(port, () => {
    console.log(`🚀 Unified API Server running on port ${port}`);
    console.log(`📱 WhatsApp API: http://localhost:${port}/api/wap`);
    console.log(`📍 CEP API: http://localhost:${port}/api/cep`);
  });
}

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = { app, startServer };