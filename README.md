# AI CV Screening and Interview System

An intelligent recruitment platform that automates CV screening and conducts AI-powered interviews using natural language processing, speech-to-text, and text-to-speech technologies.

## Architecture

The system consists of three main services:

- **Backend**: Node.js + Express main service for CV processing, AI integration, and interview management
- **Frontend**: Vite + React application for user interface
- **TTS Service**: Python + FastAPI service using XTTSv2 for text-to-speech
- **STT Service**: Python + FastAPI service using OpenAI Whisper for speech-to-text

## Features

- 🤖 **AI-Powered CV Analysis**: Automated parsing and qualification assessment using OpenRouter AI models
- 🎙️ **Interactive AI Interviews**: Real-time conversational interviews with TTS/STT capabilities
- 🔍 **Skills Verification**: Confirmation of technical and soft skills through dynamic questioning
- 🎵 **Audio Processing**: XTTSv2 for speech synthesis and OpenAI Whisper for speech recognition
- 📊 **Qualification Scoring**: Structured evaluation and notes generation
- 📄 **PDF Report Generation**: Automated interview result reports with detailed candidate assessment

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+
- MongoDB
- OpenRouter API key

### Environment Setup

1. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp tts-service/.env.example tts-service/.env
   cp stt-service/.env.example stt-service/.env
   ```

2. Configure your OpenRouter API key in `backend/.env`

### Running with Docker (Recommended)

```bash
docker-compose up -d
```

### Running Manually

1. **Backend Service**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **TTS Service**:
   ```bash
   cd tts-service
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8001
   ```

4. **STT Service**:
   ```bash
   cd stt-service
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8002
   ```

## API Documentation

- Backend API: http://localhost:3000/api/docs
- TTS Service: http://localhost:8001/docs
- STT Service: http://localhost:8002/docs

## License

MIT License