
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import applicationRoutes from './src/routes/applications.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'
  })
);

app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    success: connected,
    message: connected
      ? 'Job Tracker API and MongoDB are connected'
      : 'Job Tracker API is running, but MongoDB is not connected',
    data: {
      api: 'running',
      database: connected ? 'connected' : 'disconnected'
    }
  });
});

// Application routes
app.use('/api/applications', applicationRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  const status =
    err.status || (err.name === 'ValidationError' ? 400 : 500);

  const message =
    err.name === 'ValidationError'
      ? Object.values(err.errors)
          .map(error => error.message)
          .join(', ')
      : err.message || 'Server error';

  console.error('Request error:', message);

  res.status(status).json({
    success: false,
    message,
    data: null
  });
});

// Start server only after MongoDB connects
const port = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error(
      'MongoDB connection string is missing. Check backend/.env'
    );
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB Atlas...');

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log('MongoDB connected successfully!');
    console.log(`Database: ${mongoose.connection.name}`);

    app.listen(port, () => {
      console.log(`API ready at http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error(
      'Check your Atlas URI, database username/password, and Network Access settings.'
    );
    process.exit(1);
  }
}

startServer();
