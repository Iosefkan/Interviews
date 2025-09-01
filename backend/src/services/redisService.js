import redis from 'redis';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.log('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > this.maxReconnectAttempts) {
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('connect', () => {
        console.log('✅ Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Session state management
  async setSessionState(sessionId, state, ttl = 3600) {
    if (!this.isConnected) return false;
    
    try {
      const key = `session:${sessionId}`;
      await this.client.setEx(key, ttl, JSON.stringify({
        ...state,
        lastUpdate: Date.now()
      }));
      return true;
    } catch (error) {
      console.error('Redis setSessionState error:', error);
      return false;
    }
  }

  async getSessionState(sessionId) {
    if (!this.isConnected) return null;
    
    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getSessionState error:', error);
      return null;
    }
  }

  async updateSessionState(sessionId, updates, ttl = 3600) {
    if (!this.isConnected) return false;
    
    try {
      const currentState = await this.getSessionState(sessionId);
      if (!currentState) return false;

      const newState = {
        ...currentState,
        ...updates,
        lastUpdate: Date.now()
      };

      return await this.setSessionState(sessionId, newState, ttl);
    } catch (error) {
      console.error('Redis updateSessionState error:', error);
      return false;
    }
  }

  async deleteSessionState(sessionId) {
    if (!this.isConnected) return false;
    
    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis deleteSessionState error:', error);
      return false;
    }
  }

  // Performance metrics
  async setMetric(metricName, value, ttl = 300) {
    if (!this.isConnected) return false;
    
    try {
      const key = `metric:${metricName}:${Date.now()}`;
      await this.client.setEx(key, ttl, JSON.stringify({
        value,
        timestamp: Date.now()
      }));
      return true;
    } catch (error) {
      console.error('Redis setMetric error:', error);
      return false;
    }
  }

  async getMetrics(metricName, limit = 100) {
    if (!this.isConnected) return [];
    
    try {
      const pattern = `metric:${metricName}:*`;
      const keys = await this.client.keys(pattern);
      const sortedKeys = keys.sort().slice(-limit);
      
      const metrics = [];
      for (const key of sortedKeys) {
        const data = await this.client.get(key);
        if (data) {
          metrics.push(JSON.parse(data));
        }
      }
      
      return metrics;
    } catch (error) {
      console.error('Redis getMetrics error:', error);
      return [];
    }
  }

  // Connection quality tracking
  async setConnectionQuality(sessionId, quality) {
    if (!this.isConnected) return false;
    
    try {
      const key = `connection:${sessionId}`;
      await this.client.setEx(key, 300, JSON.stringify({
        ...quality,
        timestamp: Date.now()
      }));
      return true;
    } catch (error) {
      console.error('Redis setConnectionQuality error:', error);
      return false;
    }
  }

  async getConnectionQuality(sessionId) {
    if (!this.isConnected) return null;
    
    try {
      const key = `connection:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getConnectionQuality error:', error);
      return null;
    }
  }

  // Audio buffer management
  async storeAudioBuffer(sessionId, chunkIndex, audioData, ttl = 300) {
    if (!this.isConnected) return false;
    
    try {
      const key = `audio:${sessionId}:${chunkIndex}`;
      await this.client.setEx(key, ttl, audioData);
      return true;
    } catch (error) {
      console.error('Redis storeAudioBuffer error:', error);
      return false;
    }
  }

  async getAudioBuffer(sessionId, chunkIndex) {
    if (!this.isConnected) return null;
    
    try {
      const key = `audio:${sessionId}:${chunkIndex}`;
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis getAudioBuffer error:', error);
      return null;
    }
  }

  async clearAudioBuffers(sessionId) {
    if (!this.isConnected) return false;
    
    try {
      const pattern = `audio:${sessionId}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis clearAudioBuffers error:', error);
      return false;
    }
  }

  // Rate limiting
  async checkRateLimit(identifier, limit = 100, windowMs = 60000) {
    if (!this.isConnected) return true; // Allow if Redis is down
    
    try {
      const key = `rate:${identifier}`;
      const current = await this.client.get(key);
      
      if (!current) {
        await this.client.setEx(key, Math.ceil(windowMs / 1000), '1');
        return true;
      }
      
      const count = parseInt(current);
      if (count >= limit) {
        return false;
      }
      
      await this.client.incr(key);
      return true;
    } catch (error) {
      console.error('Redis checkRateLimit error:', error);
      return true; // Allow if error occurs
    }
  }

  // Health check
  async healthCheck() {
    if (!this.isConnected) {
      return { status: 'unhealthy', error: 'Not connected' };
    }
    
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        connected: this.isConnected
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Cleanup expired data
  async cleanup() {
    if (!this.isConnected) return;
    
    try {
      const now = Date.now();
      const expiredThreshold = now - (24 * 60 * 60 * 1000); // 24 hours ago
      
      // Clean old metrics
      const metricKeys = await this.client.keys('metric:*');
      for (const key of metricKeys) {
        const parts = key.split(':');
        const timestamp = parseInt(parts[parts.length - 1]);
        if (timestamp < expiredThreshold) {
          await this.client.del(key);
        }
      }
      
      console.log(`🧹 Redis cleanup completed, processed ${metricKeys.length} metric keys`);
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }
  }
}

export default new RedisService();