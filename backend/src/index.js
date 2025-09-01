import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { createServer } from 'http';

// Import routes
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import cvRoutes from './routes/cv.js';
import interviewRoutes from './routes/interview.js';
import healthRoutes from './routes/health.js';
import monitoringRoutes from './routes/monitoring.js';

// Import services
import emailService from './services/emailService.js';
import websocketService from './services/simpleWebSocketService.js';
import redisService from './services/redisService.js';

// Import models for initialization
import HRUser from './models/HRUser.js';
import InterviewSession from './models/InterviewSession.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Security middleware
app.use(helmet());
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving
app.use('/uploads', express.static(join(__dirname, '../uploads')));
app.use('/reports', express.static(join(__dirname, '../reports')));

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/monitoring', monitoringRoutes);

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'HR AI Recruitment Platform API',
    version: '2.0.0',
    description: 'REST API for HR authentication, job management, CV analysis and AI-powered interviews',
    endpoints: {
      health: {
        check: 'GET /api/health'
      },
      auth: {
        login: 'POST /api/auth/login',
        changePassword: 'PUT /api/auth/change-password',
        profile: 'GET /api/auth/me',
        updateProfile: 'PUT /api/auth/profile',
        logout: 'POST /api/auth/logout',
        init: 'POST /api/auth/init (dev only)'
      },
      jobs: {
        create: 'POST /api/jobs',
        list: 'GET /api/jobs',
        details: 'GET /api/jobs/:jobId',
        update: 'PUT /api/jobs/:jobId',
        updateStatus: 'PATCH /api/jobs/:jobId/status',
        delete: 'DELETE /api/jobs/:jobId',
        candidates: 'GET /api/jobs/:jobId/candidates',
        statistics: 'GET /api/jobs/:jobId/statistics'
      },
      cv: {
        upload: 'POST /api/cv/upload/:jobId (HR auth required)',
        analysis: 'GET /api/cv/analysis/:candidateId (HR auth required)',
        candidates: 'GET /api/cv/candidates (HR auth required)',
        report: 'GET /api/cv/report/:candidateId (HR auth required)',
        updateStatus: 'PATCH /api/cv/candidate/:candidateId/status (HR auth required)',
        deleteCandidate: 'DELETE /api/cv/candidate/:candidateId (HR auth required)'
      },
      interview: {
        invite: 'POST /api/interview/invite/:candidateId (HR auth required)',
        startPublic: 'POST /api/interview/start-public (session key required)',
        processAudio: 'POST /api/interview/audio/process',
        results: 'GET /api/interview/results/:sessionId (HR auth required)',
        report: 'GET /api/interview/report/:sessionId (HR auth required)',
        sessions: 'GET /api/interview/sessions (HR auth required)',
        terminate: 'POST /api/interview/terminate/:sessionId'
      }
    },
    authentication: {
      type: 'JWT Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'Required for all HR endpoints. Public interview endpoints use session keys.'
    },
    publicAccess: {
      interviewStart: 'POST /api/interview/start-public',
      healthCheck: 'GET /api/health'
    }
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Database connection and initialization
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_system');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize default HR user
    await initializeDefaultData();
    
    // Setup cleanup tasks
    setupCleanupTasks();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Initialize default data
const initializeDefaultData = async () => {
  try {
    // Initialize Redis
    console.log('🔧 Initializing Redis service...');
    await redisService.initialize();
    
    // Create default HR user if none exists
    await HRUser.createDefaultUser();
    
    // Initialize email service
    console.log('🔧 Initializing email service...');
    await emailService.initializeTransporter();
    
    console.log('✅ Default data initialization completed');
  } catch (error) {
    console.error('❌ Default data initialization failed:', error);
  }
};

// Setup cleanup tasks
const setupCleanupTasks = () => {
  // Clean up expired interview sessions every hour
  setInterval(async () => {
    try {
      await InterviewSession.cleanupExpiredSessions();
      await redisService.cleanup();
    } catch (error) {
      console.error('❌ Cleanup task failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    // Initialize WebSocket service
    websocketService.initialize(WS_PORT);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 WebSocket server running on ws://localhost:${WS_PORT}/ws/interview`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await redisService.disconnect();
  await mongoose.connection.close();
  console.log('Database and Redis connections closed.');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await redisService.disconnect();
  await mongoose.connection.close();
  console.log('Database and Redis connections closed.');
  process.exit(0);
});

startServer();