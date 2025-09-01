import express from 'express';
import audioService from '../services/audioService.js';

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = req.app.locals.mongoose?.connection?.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check external services
    const ttsHealth = await audioService.checkTtsHealth();
    const sttHealth = await audioService.checkSttHealth();

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        tts: ttsHealth.status,
        stt: sttHealth.status
      },
      version: '1.0.0',
      uptime: process.uptime()
    };

    // If any critical service is down, return unhealthy status
    const isHealthy = dbStatus === 'connected' && 
                     ttsHealth.status === 'healthy' && 
                     sttHealth.status === 'healthy';

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
    const [ttsHealth, sttHealth, voices, models] = await Promise.all([
      audioService.checkTtsHealth(),
      audioService.checkSttHealth(),
      audioService.getAvailableVoices(),
      audioService.getAvailableModels()
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

export default router;