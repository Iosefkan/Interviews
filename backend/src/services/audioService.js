import axios from 'axios';
import FormData from 'form-data';
import { performance } from 'perf_hooks';

class AudioService {
  constructor() {
    this.ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8001';
    this.sttServiceUrl = process.env.STT_SERVICE_URL || 'http://localhost:8002';
    this.metrics = {
      ttsLatency: [],
      sttLatency: [],
      audioQuality: []
    };
  }

  async generateSpeech(text, voiceSettings = {}) {
    const startTime = performance.now();
    
    try {
      const response = await axios.post(`${this.ttsServiceUrl}/generate-speech`, {
        text: text,
        voice_settings: {
          speaker: voiceSettings.speaker || 'default',
          speed: voiceSettings.speed || 1.0,
          emotion: voiceSettings.emotion || 'professional',
          language: voiceSettings.language || null // Pass language if specified
        },
        audio_format: voiceSettings.format || 'wav',
        language: voiceSettings.language || null // Also pass language at root level
      }, {
        timeout: 60000 // Increase timeout to 60 seconds
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      
      // Track performance metrics
      this.metrics.ttsLatency.push(latency);
      if (this.metrics.ttsLatency.length > 100) {
        this.metrics.ttsLatency.shift(); // Keep only last 100 measurements
      }

      return {
        ...response.data,
        processingTime: latency
      };
    } catch (error) {
      console.error('TTS Service Error:', error.response?.data || error.message);
      // Log additional details for debugging
      console.error('TTS Request Details:', {
        url: `${this.ttsServiceUrl}/generate-speech`,
        textLength: text?.length,
        voiceSettings,
        timeout: 60000
      });
      throw new Error(`Text-to-speech error: ${error.response?.data?.message || error.message}`);
    }
  }

  async transcribeAudio(audioBuffer, options = {}) {
    const startTime = performance.now();
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });

      // Add language parameter if provided
      if (options.language) {
        formData.append('language', options.language);
      }

      // Add model size parameter if provided
      if (options.modelSize) {
        formData.append('model_size', options.modelSize);
      }

      const response = await axios.post(`${this.sttServiceUrl}/transcribe`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 60000, // 60 second timeout for transcription
        maxContentLength: 100 * 1024 * 1024, // 100MB
        maxBodyLength: 100 * 1024 * 1024
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      
      // Track performance metrics
      this.metrics.sttLatency.push(latency);
      if (this.metrics.sttLatency.length > 100) {
        this.metrics.sttLatency.shift(); // Keep only last 100 measurements
      }

      return {
        ...response.data,
        processing_time: latency
      };
    } catch (error) {
      console.error('STT Service Error:', error.response?.data || error.message);
      throw new Error(`Speech-to-text error: ${error.response?.data?.message || error.message}`);
    }
  }

  async checkTtsHealth() {
    try {
      const response = await axios.get(`${this.ttsServiceUrl}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('TTS Health Check Failed:', error.message);
      return { status: 'unhealthy', error: error.message };
    }
  }

  async checkSttHealth() {
    try {
      const response = await axios.get(`${this.sttServiceUrl}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('STT Health Check Failed:', error.message);
      return { status: 'unhealthy', error: error.message };
    }
  }

  async getAvailableVoices() {
    try {
      const response = await axios.get(`${this.ttsServiceUrl}/voices`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Get Voices Error:', error.message);
      return { voices: [] };
    }
  }

  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.sttServiceUrl}/models`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Get Models Error:', error.message);
      return { models: [] };
    }
  }

  // Real-time streaming methods
  async transcribeAudioStream(audioBuffer, options = {}) {
    const startTime = performance.now();
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'stream.wav',
        contentType: 'audio/wav'
      });

      // Add streaming parameters
      formData.append('stream', 'true');
      formData.append('language', options.language || 'en');
      formData.append('model_size', options.modelSize || 'base');
      formData.append('enable_vad', options.enableVAD || 'true'); // Voice Activity Detection

      const response = await axios.post(`${this.sttServiceUrl}/transcribe-stream`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000, // Shorter timeout for streaming
        maxContentLength: 50 * 1024 * 1024, // 50MB for streaming
        maxBodyLength: 50 * 1024 * 1024
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      
      // Track streaming performance
      this.metrics.sttLatency.push(latency);
      
      return {
        ...response.data,
        processing_time: latency,
        is_stream: true
      };
    } catch (error) {
      console.error('STT Streaming Error:', error.response?.data || error.message);
      throw new Error(`Speech-to-text streaming error: ${error.response?.data?.message || error.message}`);
    }
  }

  async generateSpeechStream(text, voiceSettings = {}) {
    const startTime = performance.now();
    
    try {
      const response = await axios.post(`${this.ttsServiceUrl}/generate-speech-stream`, {
        text: text,
        voice_settings: {
          speaker: voiceSettings.speaker || 'default',
          speed: voiceSettings.speed || 1.0,
          emotion: voiceSettings.emotion || 'professional',
          streaming: true
        },
        audio_format: voiceSettings.format || 'wav',
        chunk_size: voiceSettings.chunkSize || 1024
      }, {
        timeout: 20000, // Shorter timeout for streaming
        responseType: 'stream'
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      
      this.metrics.ttsLatency.push(latency);
      
      return {
        audioStream: response.data,
        processingTime: latency,
        is_stream: true
      };
    } catch (error) {
      console.error('TTS Streaming Error:', error.response?.data || error.message);
      // Fallback to regular TTS if streaming fails
      return await this.generateSpeech(text, voiceSettings);
    }
  }

  // Audio quality assessment
  async assessAudioQuality(audioBuffer) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'quality_check.wav',
        contentType: 'audio/wav'
      });

      const response = await axios.post(`${this.sttServiceUrl}/quality-check`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 10000
      });

      const qualityScore = response.data.quality_score || 0;
      this.metrics.audioQuality.push(qualityScore);
      
      if (this.metrics.audioQuality.length > 50) {
        this.metrics.audioQuality.shift();
      }

      return response.data;
    } catch (error) {
      console.error('Audio Quality Assessment Error:', error.message);
      return { 
        quality_score: 0.5, 
        issues: ['Unable to assess quality'],
        noise_level: 'unknown'
      };
    }
  }

  // Performance monitoring
  getPerformanceMetrics() {
    const calculateAverage = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    return {
      tts: {
        averageLatency: calculateAverage(this.metrics.ttsLatency),
        recentLatency: this.metrics.ttsLatency.slice(-10),
        sampleCount: this.metrics.ttsLatency.length
      },
      stt: {
        averageLatency: calculateAverage(this.metrics.sttLatency),
        recentLatency: this.metrics.sttLatency.slice(-10),
        sampleCount: this.metrics.sttLatency.length
      },
      audioQuality: {
        averageScore: calculateAverage(this.metrics.audioQuality),
        recentScores: this.metrics.audioQuality.slice(-10),
        sampleCount: this.metrics.audioQuality.length
      }
    };
  }

  // Health checks with detailed metrics
  async checkServicesHealth() {
    const ttsHealth = await this.checkTtsHealth();
    const sttHealth = await this.checkSttHealth();
    const metrics = this.getPerformanceMetrics();
    
    return {
      tts: ttsHealth,
      stt: sttHealth,
      performance: metrics,
      overall: {
        status: ttsHealth.status === 'healthy' && sttHealth.status === 'healthy' ? 'healthy' : 'degraded',
        lastChecked: new Date().toISOString()
      }
    };
  }
}

export default new AudioService();