# AI CV Screening and Interview System - Setup Guide

## Quick Start Instructions

### 1. Prerequisites
- Node.js 18+ 
- Python 3.8+
- MongoDB (or use Docker)
- OpenRouter API key

### 2. Environment Setup

#### Backend Service
```bash
cd backend
cp .env.example .env
# Edit .env and add your OpenRouter API key
npm install
```

#### TTS Service  
```bash
cd tts-service
cp .env.example .env
pip install -r requirements.txt
```

#### STT Service
```bash
cd stt-service  
cp .env.example .env
pip install -r requirements.txt
```

#### Frontend
```bash
cd frontend
cp .env.example .env
npm install
```

### 3. Running the Services

#### Option A: Docker (Recommended)
```bash
# Copy environment files first
cp backend/.env.example backend/.env
cp tts-service/.env.example tts-service/.env  
cp stt-service/.env.example stt-service/.env
cp frontend/.env.example frontend/.env

# Add your OpenRouter API key to backend/.env
# Then start all services
docker-compose up -d
```

#### Option B: Manual Setup
```bash
# Terminal 1 - MongoDB (if not using Docker)
mongod

# Terminal 2 - Backend
cd backend
npm run dev

# Terminal 3 - TTS Service  
cd tts-service
python main.py

# Terminal 4 - STT Service
cd stt-service
python main.py

# Terminal 5 - Frontend
cd frontend
npm run dev
```

### 4. Access Points
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/docs
- TTS Service: http://localhost:8001/docs
- STT Service: http://localhost:8002/docs

### 5. Configuration Required

#### OpenRouter API Key
1. Get API key from https://openrouter.ai
2. Add to `backend/.env`:
   ```
   OPENROUTER_API_KEY=your_api_key_here
   ```

#### Model Selection
Default models in `backend/.env`:
```
OPENROUTER_MODEL=anthropic/claude-3-sonnet
```

### 6. Usage Workflow
1. Upload CV via frontend
2. AI analyzes and scores candidate  
3. If qualified, start AI interview
4. Voice-to-voice interaction during interview
5. Generate PDF report with results

### 7. Features Implemented
- ✅ CV PDF parsing and text extraction
- ✅ OpenRouter AI integration for CV analysis
- ✅ XTTSv2 text-to-speech service
- ✅ OpenAI Whisper speech-to-text service  
- ✅ AI interview conductor with dynamic questioning
- ✅ PDF report generation with Puppeteer
- ✅ React frontend with Material-UI
- ✅ Real-time audio processing pipeline
- ✅ MongoDB data persistence
- ✅ Docker containerization

### 8. Troubleshooting
- Ensure all services are running on correct ports
- Check MongoDB connection
- Verify OpenRouter API key is valid
- TTS/STT services may take time to load models on first run
- Check Docker logs: `docker-compose logs [service-name]`