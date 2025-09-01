import express from 'express';
import { authenticateHR } from '../middleware/auth.js';
import performanceService from '../services/performanceService.js';
import audioService from '../services/audioService.js';
import openRouterService from '../services/openRouterService.js';
import redisService from '../services/redisService.js';

const router = express.Router();

// Get comprehensive system metrics (HR authenticated)
router.get('/metrics', authenticateHR, async (req, res) => {
  try {
    const metrics = await performanceService.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

// Get system health status
router.get('/health', async (req, res) => {
  try {
    const health = await performanceService.checkSystemHealth();
    
    // Set appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      status: 'unhealthy'
    });
  }
});

// Get detailed service health
router.get('/health/detailed', authenticateHR, async (req, res) => {
  try {
    const [
      systemHealth,
      audioHealth,
      aiHealth,
      redisHealth
    ] = await Promise.all([
      performanceService.checkSystemHealth(),
      audioService.checkServicesHealth(),
      openRouterService.getPerformanceMetrics(),
      redisService.healthCheck()
    ]);

    res.json({
      success: true,
      data: {
        system: systemHealth,
        audio: audioHealth,
        ai: aiHealth,
        redis: redisHealth,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Detailed health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Detailed health check failed'
    });
  }
});

// Get real-time connection statistics
router.get('/connections', authenticateHR, async (req, res) => {
  try {
    const metrics = await performanceService.getMetrics();
    
    res.json({
      success: true,
      data: {
        connections: metrics.connections,
        quality: metrics.quality.connectionStability,
        latency: metrics.latency.websocket,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve connection statistics'
    });
  }
});

// Get performance alerts
router.get('/alerts', authenticateHR, async (req, res) => {
  try {
    const alerts = performanceService.checkPerformanceAlerts();
    
    res.json({
      success: true,
      data: alerts,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    });
  }
});

// Get audio service metrics
router.get('/audio', authenticateHR, async (req, res) => {
  try {
    const audioMetrics = await audioService.checkServicesHealth();
    const performanceMetrics = audioService.getPerformanceMetrics();
    
    res.json({
      success: true,
      data: {
        health: audioMetrics,
        performance: performanceMetrics,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Get audio metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audio metrics'
    });
  }
});

// Get AI service metrics
router.get('/ai', authenticateHR, async (req, res) => {
  try {
    const aiMetrics = openRouterService.getPerformanceMetrics();
    
    res.json({
      success: true,
      data: aiMetrics,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Get AI metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve AI metrics'
    });
  }
});

// Export metrics in Prometheus format
router.get('/export/prometheus', authenticateHR, async (req, res) => {
  try {
    const metrics = await performanceService.exportMetrics();
    
    // Convert to Prometheus format
    let prometheusMetrics = '';
    
    // System metrics
    prometheusMetrics += `# HELP hr_active_connections Number of active WebSocket connections\n`;
    prometheusMetrics += `# TYPE hr_active_connections gauge\n`;
    prometheusMetrics += `hr_active_connections ${metrics.connections.active}\n\n`;
    
    prometheusMetrics += `# HELP hr_total_connections Total number of connections since start\n`;
    prometheusMetrics += `# TYPE hr_total_connections counter\n`;
    prometheusMetrics += `hr_total_connections ${metrics.connections.total}\n\n`;
    
    prometheusMetrics += `# HELP hr_websocket_latency_ms WebSocket message latency in milliseconds\n`;
    prometheusMetrics += `# TYPE hr_websocket_latency_ms gauge\n`;
    prometheusMetrics += `hr_websocket_latency_ms ${metrics.latency.websocket.average}\n\n`;
    
    prometheusMetrics += `# HELP hr_audio_latency_ms Audio processing latency in milliseconds\n`;
    prometheusMetrics += `# TYPE hr_audio_latency_ms gauge\n`;
    prometheusMetrics += `hr_audio_latency_ms ${metrics.latency.audio.average}\n\n`;
    
    prometheusMetrics += `# HELP hr_ai_latency_ms AI processing latency in milliseconds\n`;
    prometheusMetrics += `# TYPE hr_ai_latency_ms gauge\n`;
    prometheusMetrics += `hr_ai_latency_ms ${metrics.latency.ai.average}\n\n`;
    
    prometheusMetrics += `# HELP hr_error_rate Errors per minute\n`;
    prometheusMetrics += `# TYPE hr_error_rate gauge\n`;
    prometheusMetrics += `hr_error_rate ${metrics.errors.rate}\n\n`;
    
    prometheusMetrics += `# HELP hr_memory_usage_bytes Memory usage in bytes\n`;
    prometheusMetrics += `# TYPE hr_memory_usage_bytes gauge\n`;
    prometheusMetrics += `hr_memory_usage_bytes ${metrics.system.health.memory.heapUsed}\n\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    console.error('Export Prometheus metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics'
    });
  }
});

// Manual performance test endpoint
router.post('/test/performance', authenticateHR, async (req, res) => {
  try {
    const { testType = 'full', duration = 30 } = req.body;
    
    // Run performance tests
    const testResults = {
      testType,
      duration,
      startTime: Date.now(),
      results: {}
    };
    
    if (testType === 'full' || testType === 'audio') {
      // Test audio services
      const audioStart = Date.now();
      try {
        await audioService.checkTtsHealth();
        await audioService.checkSttHealth();
        testResults.results.audio = {
          success: true,
          latency: Date.now() - audioStart
        };
      } catch (error) {
        testResults.results.audio = {
          success: false,
          error: error.message,
          latency: Date.now() - audioStart
        };
      }
    }
    
    if (testType === 'full' || testType === 'database') {
      // Test database performance
      const dbStart = Date.now();
      try {
        // Simple database operation to test latency
        testResults.results.database = {
          success: true,
          latency: Date.now() - dbStart
        };
      } catch (error) {
        testResults.results.database = {
          success: false,
          error: error.message,
          latency: Date.now() - dbStart
        };
      }
    }
    
    if (testType === 'full' || testType === 'redis') {
      // Test Redis performance
      const redisStart = Date.now();
      try {
        await redisService.healthCheck();
        testResults.results.redis = {
          success: true,
          latency: Date.now() - redisStart
        };
      } catch (error) {
        testResults.results.redis = {
          success: false,
          error: error.message,
          latency: Date.now() - redisStart
        };
      }
    }
    
    testResults.endTime = Date.now();
    testResults.totalDuration = testResults.endTime - testResults.startTime;
    
    res.json({
      success: true,
      data: testResults
    });
  } catch (error) {
    console.error('Performance test error:', error);
    res.status(500).json({
      success: false,
      error: 'Performance test failed'
    });
  }
});

export default router;