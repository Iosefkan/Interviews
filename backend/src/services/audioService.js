import axios from 'axios';
import FormData from 'form-data';

class AudioService {
  constructor() {
    this.ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8001';
    this.sttServiceUrl = process.env.STT_SERVICE_URL || 'http://localhost:8002';
  }

  async generateSpeech(text, voiceSettings = {}) {
    try {
      const response = await axios.post(`${this.ttsServiceUrl}/generate-speech`, {
        text: text,
        voice_settings: {
          speaker: voiceSettings.speaker || 'default',
          speed: voiceSettings.speed || 1.0,
          emotion: voiceSettings.emotion || 'professional'
        },
        audio_format: voiceSettings.format || 'wav'
      }, {
        timeout: 30000 // 30 second timeout
      });

      return response.data;
    } catch (error) {
      console.error('TTS Service Error:', error.response?.data || error.message);
      throw new Error(`Text-to-speech error: ${error.response?.data?.message || error.message}`);
    }
  }

  async transcribeAudio(audioBuffer, options = {}) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });

      if (options.language) {
        formData.append('language', options.language);
      }

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

      return response.data;
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
}

export default new AudioService();