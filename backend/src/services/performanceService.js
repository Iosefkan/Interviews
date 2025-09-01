import redisService from './redisService.js';
import audioService from './audioService.js';
import openRouterService from './openRouterService.js';

class PerformanceService {
  constructor() {
    this.metrics = {
      // System metrics
      systemHealth: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: 0
      },
      
      // Real-time metrics
      activeConnections: 0,
      totalConnections: 0,
      messagesProcessed: 0,
      errorsCount: 0,
      
      // Latency tracking
      latencyStats: {
        websocket: [],
        audio: [],
        ai: [],
        database: []
      },
      
      // Throughput tracking
      throughput: {
        audioChunks: 0,
        transcriptions: 0,
        aiResponses: 0,
        messages: 0
      },
      
      // Quality metrics
      quality: {
        audioQuality: [],
        transcriptionAccuracy: [],
        connectionStability: []
      }
    };
    
    this.startTime = Date.now();
    this.lastResetTime = Date.now();
    
    // Start monitoring
    this.startSystemMonitoring();
  }

  startSystemMonitoring() {
    // Monitor system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
    
    // Reset throughput counters every minute
    setInterval(() => {
      this.resetThroughputCounters();
    }, 60000);
    
    // Cleanup old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  collectSystemMetrics() {
    this.metrics.systemHealth = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
    
    // Store in Redis for persistence
    redisService.setMetric('system_health', this.metrics.systemHealth);
  }

  resetThroughputCounters() {
    const currentThroughput = { ...this.metrics.throughput };
    
    // Store current throughput before reset
    redisService.setMetric('throughput', {
      ...currentThroughput,
      timestamp: Date.now(),
      duration: Date.now() - this.lastResetTime
    });
    
    // Reset counters
    this.metrics.throughput = {
      audioChunks: 0,
      transcriptions: 0,
      aiResponses: 0,
      messages: 0
    };
    
    this.lastResetTime = Date.now();
  }

  cleanupOldMetrics() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Cleanup latency arrays (keep last 1000 measurements)
    Object.keys(this.metrics.latencyStats).forEach(key => {
      const stats = this.metrics.latencyStats[key];
      if (stats.length > 1000) {
        this.metrics.latencyStats[key] = stats.slice(-1000);
      }
    });
    
    // Cleanup quality arrays
    Object.keys(this.metrics.quality).forEach(key => {
      const stats = this.metrics.quality[key];
      if (stats.length > 500) {
        this.metrics.quality[key] = stats.slice(-500);
      }
    });
  }

  // Connection tracking
  trackConnection(action, sessionId = null) {
    switch (action) {
      case 'connect':
        this.metrics.activeConnections++;
        this.metrics.totalConnections++;
        break;
      case 'disconnect':
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        break;
    }
    
    redisService.setMetric('connections', {
      active: this.metrics.activeConnections,
      total: this.metrics.totalConnections,
      action,
      sessionId,
      timestamp: Date.now()
    });
  }

  // Latency tracking
  trackLatency(type, latency, context = {}) {
    if (!this.metrics.latencyStats[type]) {
      this.metrics.latencyStats[type] = [];
    }
    
    const latencyData = {
      value: latency,
      timestamp: Date.now(),
      ...context
    };
    
    this.metrics.latencyStats[type].push(latencyData);
    
    // Store in Redis
    redisService.setMetric(`latency_${type}`, latencyData);
  }

  // Throughput tracking
  trackThroughput(type, count = 1) {
    if (this.metrics.throughput[type] !== undefined) {
      this.metrics.throughput[type] += count;
    }
  }

  // Quality tracking
  trackQuality(type, score, context = {}) {
    if (!this.metrics.quality[type]) {
      this.metrics.quality[type] = [];
    }
    
    const qualityData = {
      score,
      timestamp: Date.now(),
      ...context
    };
    
    this.metrics.quality[type].push(qualityData);
    
    redisService.setMetric(`quality_${type}`, qualityData);
  }

  // Error tracking
  trackError(errorType, context = {}) {
    this.metrics.errorsCount++;
    
    redisService.setMetric('errors', {
      type: errorType,
      count: this.metrics.errorsCount,
      context,
      timestamp: Date.now()
    });
  }

  // Message processing tracking
  trackMessage(type, processingTime, success = true) {
    this.metrics.messagesProcessed++;
    this.trackThroughput('messages');
    
    if (processingTime) {
      this.trackLatency('websocket', processingTime, { type, success });
    }
    
    if (!success) {
      this.trackError('message_processing', { type });
    }
  }

  // Audio processing tracking
  trackAudioProcessing(stage, latency, quality = null, context = {}) {
    this.trackLatency('audio', latency, { stage, ...context });
    
    if (stage === 'chunk_received') {
      this.trackThroughput('audioChunks');
    } else if (stage === 'transcription_complete') {
      this.trackThroughput('transcriptions');
      if (quality) {
        this.trackQuality('transcriptionAccuracy', quality.confidence, context);
      }
    }
  }

  // AI processing tracking
  trackAIProcessing(stage, latency, context = {}) {
    this.trackLatency('ai', latency, { stage, ...context });
    
    if (stage === 'response_generated') {
      this.trackThroughput('aiResponses');
    }
  }

  // Database operation tracking
  trackDatabaseOperation(operation, latency, success = true) {
    this.trackLatency('database', latency, { operation, success });
    
    if (!success) {
      this.trackError('database_operation', { operation });
    }
  }

  // Get comprehensive metrics
  async getMetrics() {
    // Calculate derived metrics
    const now = Date.now();
    const uptimeMs = now - this.startTime;
    
    // Calculate averages
    const calculateAverage = (arr) => {
      if (arr.length === 0) return 0;
      return arr.reduce((sum, item) => sum + (item.value || item.score || item), 0) / arr.length;
    };
    
    const getRecentMetrics = (arr, minutes = 5) => {
      const cutoff = now - (minutes * 60 * 1000);
      return arr.filter(item => item.timestamp > cutoff);
    };

    // Get service-specific metrics
    const audioMetrics = audioService.getPerformanceMetrics();
    const aiMetrics = openRouterService.getPerformanceMetrics();
    const redisHealth = await redisService.healthCheck();

    return {
      // System overview
      system: {
        uptime: uptimeMs,
        startTime: this.startTime,
        health: this.metrics.systemHealth,
        redis: redisHealth
      },
      
      // Connection metrics
      connections: {
        active: this.metrics.activeConnections,
        total: this.metrics.totalConnections,
        rate: this.metrics.totalConnections / (uptimeMs / 1000 / 60) // connections per minute
      },
      
      // Latency metrics
      latency: {
        websocket: {
          average: calculateAverage(this.metrics.latencyStats.websocket),
          recent: calculateAverage(getRecentMetrics(this.metrics.latencyStats.websocket)),
          p95: this.calculatePercentile(this.metrics.latencyStats.websocket, 95)
        },
        audio: {
          average: calculateAverage(this.metrics.latencyStats.audio),
          recent: calculateAverage(getRecentMetrics(this.metrics.latencyStats.audio)),
          p95: this.calculatePercentile(this.metrics.latencyStats.audio, 95),
          serviceMetrics: audioMetrics
        },
        ai: {
          average: calculateAverage(this.metrics.latencyStats.ai),
          recent: calculateAverage(getRecentMetrics(this.metrics.latencyStats.ai)),
          p95: this.calculatePercentile(this.metrics.latencyStats.ai, 95),
          serviceMetrics: aiMetrics
        },
        database: {
          average: calculateAverage(this.metrics.latencyStats.database),
          recent: calculateAverage(getRecentMetrics(this.metrics.latencyStats.database)),
          p95: this.calculatePercentile(this.metrics.latencyStats.database, 95)
        }
      },
      
      // Throughput metrics
      throughput: {
        current: this.metrics.throughput,
        rates: {
          audioChunks: this.metrics.throughput.audioChunks / ((now - this.lastResetTime) / 1000),
          transcriptions: this.metrics.throughput.transcriptions / ((now - this.lastResetTime) / 1000),
          aiResponses: this.metrics.throughput.aiResponses / ((now - this.lastResetTime) / 1000),
          messages: this.metrics.throughput.messages / ((now - this.lastResetTime) / 1000)
        }
      },
      
      // Quality metrics
      quality: {
        audioQuality: {
          average: calculateAverage(this.metrics.quality.audioQuality),
          recent: calculateAverage(getRecentMetrics(this.metrics.quality.audioQuality))
        },
        transcriptionAccuracy: {
          average: calculateAverage(this.metrics.quality.transcriptionAccuracy),
          recent: calculateAverage(getRecentMetrics(this.metrics.quality.transcriptionAccuracy))
        },
        connectionStability: {
          average: calculateAverage(this.metrics.quality.connectionStability),
          recent: calculateAverage(getRecentMetrics(this.metrics.quality.connectionStability))
        }
      },
      
      // Error metrics
      errors: {
        total: this.metrics.errorsCount,
        rate: this.metrics.errorsCount / (uptimeMs / 1000 / 60) // errors per minute
      },
      
      // Processing metrics
      processing: {
        messagesProcessed: this.metrics.messagesProcessed,
        rate: this.metrics.messagesProcessed / (uptimeMs / 1000 / 60)
      }
    };
  }

  calculatePercentile(data, percentile) {
    if (data.length === 0) return 0;
    
    const values = data.map(item => item.value || item.score || item).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  // Health check
  async checkSystemHealth() {
    const metrics = await this.getMetrics();
    const issues = [];
    
    // Check various health indicators
    if (metrics.latency.websocket.recent > 1000) {
      issues.push('High WebSocket latency detected');
    }
    
    if (metrics.latency.audio.recent > 5000) {
      issues.push('High audio processing latency detected');
    }
    
    if (metrics.latency.ai.recent > 10000) {
      issues.push('High AI processing latency detected');
    }
    
    if (metrics.errors.rate > 5) {
      issues.push('High error rate detected');
    }
    
    if (metrics.quality.transcriptionAccuracy.recent < 0.8) {
      issues.push('Low transcription accuracy detected');
    }
    
    // Check memory usage
    const memoryUsage = metrics.system.health.memory.heapUsed / metrics.system.health.memory.heapTotal;
    if (memoryUsage > 0.9) {
      issues.push('High memory usage detected');
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : issues.length < 3 ? 'degraded' : 'unhealthy',
      issues,
      metrics: {
        latency: metrics.latency.websocket.recent,
        errorRate: metrics.errors.rate,
        memoryUsage: Math.round(memoryUsage * 100),
        connections: metrics.connections.active
      },
      timestamp: Date.now()
    };
  }

  // Performance alerts
  checkPerformanceAlerts() {
    const alerts = [];
    
    // Implement alert logic based on thresholds
    // This would typically integrate with monitoring systems
    
    return alerts;
  }

  // Export metrics for external monitoring
  async exportMetrics() {
    const metrics = await this.getMetrics();
    
    // Format for Prometheus or other monitoring systems
    return {
      timestamp: Date.now(),
      ...metrics
    };
  }
}

export default new PerformanceService();