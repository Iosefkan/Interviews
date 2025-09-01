import express from 'express';
import audioService from '../services/audioService.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = req.app.locals.mongoose?.connection?.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check external services
    const ttsHealth = await audioService.checkTtsHealth();
    const sttHealth = await audioService.checkSttHealth();
    const emailHealth = await emailService.testEmailConfiguration();

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        tts: ttsHealth.status,
        stt: sttHealth.status,
        email: emailHealth.success ? 'healthy' : (emailHealth.configured ? 'error' : 'not_configured')
      },
      version: '1.0.0',
      uptime: process.uptime()
    };

    // If any critical service is down, return unhealthy status
    const isHealthy = dbStatus === 'connected' && 
                     ttsHealth.status === 'healthy' && 
                     sttHealth.status === 'healthy';
    // Note: email service is not considered critical for basic health

    if (!isHealthy) {
      healthStatus.status = 'degraded';
      return res.status(503).json(healthStatus);
    }

    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed service status
router.get('/detailed', async (req, res) => {
  try {
    const [ttsHealth, sttHealth, voices, models, emailHealth] = await Promise.all([
      audioService.checkTtsHealth(),
      audioService.checkSttHealth(),
      audioService.getAvailableVoices(),
      audioService.getAvailableModels(),
      emailService.testEmailConfiguration()
    ]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: req.app.locals.mongoose?.connection?.readyState === 1 ? 'connected' : 'disconnected',
          host: process.env.MONGODB_URI?.split('@')[1]?.split('/')[0] || 'unknown'
        },
        tts: {
          ...ttsHealth,
          availableVoices: voices.voices?.length || 0
        },
        stt: {
          ...sttHealth,
          availableModels: models.models?.length || 0
        },
        email: {
          configured: emailHealth.configured,
          status: emailHealth.success ? 'working' : 'error',
          message: emailHealth.message
        }
      },
      environment: process.env.NODE_ENV,
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Email service test endpoint
router.get('/email', async (req, res) => {
  try {
    const emailHealth = await emailService.testEmailConfiguration();
    res.json({
      timestamp: new Date().toISOString(),
      email: {
        configured: emailHealth.configured,
        status: emailHealth.success ? 'working' : 'error',
        message: emailHealth.message,
        instructions: emailHealth.configured ? 
          'Email service is properly configured and ready to send invitations.' :
          'To configure email service, set EMAIL_USER and EMAIL_PASSWORD in your environment variables.'
      }
    });
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      email: {
        configured: false,
        status: 'error',
        message: error.message
      }
    });
  }
});

export default router;