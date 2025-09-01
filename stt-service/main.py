from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import whisper
import torch
import os
import tempfile
import asyncio
import logging
from datetime import datetime
import librosa
import soundfile as sf
import ffmpeg
from dotenv import load_dotenv
import uuid
import json

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="STT Service",
    description="Speech-to-Text service using OpenAI Whisper",
    version="1.0.0"
)

# Configuration
TEMP_AUDIO_DIR = os.getenv("TEMP_AUDIO_DIR", "./temp")
MAX_AUDIO_SIZE = int(os.getenv("MAX_AUDIO_SIZE", "52428800"))  # 50MB
DEFAULT_WHISPER_MODEL = os.getenv("DEFAULT_WHISPER_MODEL", "base")
TORCH_DEVICE = os.getenv("TORCH_DEVICE", "auto")
ENABLE_GPU = os.getenv("ENABLE_GPU", "true").lower() == "true"
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "5"))

# Global variables
whisper_models = {}
model_loading = {}
current_requests = 0

# Ensure temp directory exists
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

# Pydantic models
class TranscriptionRequest(BaseModel):
    language: Optional[str] = Field(default="auto", description="Language code (e.g., 'en', 'auto')")
    model_size: Optional[str] = Field(default="base", pattern="^(tiny|base|small|medium|large)$")

class TranscriptionSegment(BaseModel):
    text: str
    start: float
    end: float
    confidence: Optional[float] = None

class TranscriptionResponse(BaseModel):
    transcription: str
    confidence: float
    language: str
    duration: float
    processing_time: float
    segments: List[TranscriptionSegment]

class ModelInfo(BaseModel):
    name: str
    size: str
    languages: List[str]
    accuracy: str
    speed: str

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    gpu_available: bool
    supported_formats: List[str]

def get_device():
    """Determine the best device to use"""
    if TORCH_DEVICE == "auto":
        return "cuda" if torch.cuda.is_available() and ENABLE_GPU else "cpu"
    return TORCH_DEVICE

async def load_whisper_model(model_size: str = DEFAULT_WHISPER_MODEL):
    """Load Whisper model if not already loaded"""
    global whisper_models, model_loading
    
    if model_size in whisper_models:
        return whisper_models[model_size]
    
    if model_size in model_loading:
        # Wait for model to finish loading
        while model_loading[model_size]:
            await asyncio.sleep(0.1)
        return whisper_models.get(model_size)
    
    model_loading[model_size] = True
    logger.info(f"Loading Whisper model: {model_size}")
    
    try:
        device = get_device()
        model = whisper.load_model(model_size, device=device)
        whisper_models[model_size] = model
        logger.info(f"Whisper model {model_size} loaded successfully on {device}")
        return model
    except Exception as e:
        logger.error(f"Failed to load Whisper model {model_size}: {e}")
        raise e
    finally:
        model_loading[model_size] = False

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    logger.info("Starting STT Service...")
    try:
        # Pre-load default model
        await load_whisper_model(DEFAULT_WHISPER_MODEL)
    except Exception as e:
        logger.error(f"Failed to initialize STT service: {e}")

def convert_audio_format(input_path: str, output_path: str, target_sr: int = 16000):
    """Convert audio to the required format for Whisper"""
    try:
        # Use ffmpeg to convert audio
        (
            ffmpeg
            .input(input_path)
            .output(output_path, acodec='pcm_s16le', ac=1, ar=target_sr)
            .overwrite_output()
            .run(quiet=True)
        )
        return True
    except Exception as e:
        logger.error(f"Audio conversion error: {e}")
        # Fallback to librosa if ffmpeg fails
        try:
            audio, sr = librosa.load(input_path, sr=target_sr, mono=True)
            sf.write(output_path, audio, target_sr)
            return True
        except Exception as e2:
            logger.error(f"Librosa conversion error: {e2}")
            return False

async def cleanup_temp_files():
    """Background task to clean up temporary files"""
    try:
        import time
        current_time = time.time()
        for filename in os.listdir(TEMP_AUDIO_DIR):
            file_path = os.path.join(TEMP_AUDIO_DIR, filename)
            if os.path.isfile(file_path):
                file_age = current_time - os.path.getctime(file_path)
                # Remove files older than 30 minutes
                if file_age > 1800:
                    os.remove(file_path)
                    logger.info(f"Cleaned up temp file: {filename}")
    except Exception as e:
        logger.error(f"Error cleaning up temp files: {e}")

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    language: Optional[str] = "auto",
    model_size: Optional[str] = "base"
):
    """Transcribe audio using OpenAI Whisper"""
    global current_requests
    
    # Check concurrent request limit
    if current_requests >= MAX_CONCURRENT_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many concurrent requests")
    
    current_requests += 1
    start_time = datetime.now()
    
    try:
        # Validate file size
        if audio.size and audio.size > MAX_AUDIO_SIZE:
            raise HTTPException(status_code=413, detail="Audio file too large")
        
        # Validate model size
        valid_models = ["tiny", "base", "small", "medium", "large"]
        if model_size not in valid_models:
            raise HTTPException(status_code=400, detail=f"Invalid model size. Must be one of: {valid_models}")
        
        # Load appropriate model
        model = await load_whisper_model(model_size)
        if not model:
            raise HTTPException(status_code=503, detail="Failed to load Whisper model")
        
        # Save uploaded file temporarily
        file_id = str(uuid.uuid4())
        temp_input_path = os.path.join(TEMP_AUDIO_DIR, f"input_{file_id}_{audio.filename}")
        temp_output_path = os.path.join(TEMP_AUDIO_DIR, f"converted_{file_id}.wav")
        
        # Write uploaded file
        with open(temp_input_path, "wb") as temp_file:
            content = await audio.read()
            temp_file.write(content)
        
        # Convert audio format if needed
        audio_path = temp_input_path
        try:
            # Check if conversion is needed
            if not audio.filename.lower().endswith('.wav'):
                if convert_audio_format(temp_input_path, temp_output_path):
                    audio_path = temp_output_path
        except Exception as e:
            logger.warning(f"Audio conversion failed, using original: {e}")
        
        # Transcribe audio
        logger.info(f"Transcribing audio with model {model_size}...")
        
        # Set language parameter
        language_param = None if language == "auto" else language
        
        result = model.transcribe(
            audio_path,
            language=language_param,
            task="transcribe",
            fp16=torch.cuda.is_available() and ENABLE_GPU
        )
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Extract segments with confidence scores
        segments = []
        for segment in result.get("segments", []):
            segments.append(TranscriptionSegment(
                text=segment["text"].strip(),
                start=segment["start"],
                end=segment["end"],
                confidence=getattr(segment, 'confidence', None)
            ))
        
        # Calculate overall confidence (average of segment confidences)
        confidence_scores = [seg.confidence for seg in segments if seg.confidence is not None]
        overall_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.8
        
        # Get audio duration
        duration = result.get("duration", 0)
        
        # Schedule cleanup
        background_tasks.add_task(cleanup_temp_files)
        
        # Clean up temporary files immediately
        try:
            if os.path.exists(temp_input_path):
                os.remove(temp_input_path)
            if os.path.exists(temp_output_path):
                os.remove(temp_output_path)
        except Exception as e:
            logger.warning(f"Failed to clean up temp files: {e}")
        
        return TranscriptionResponse(
            transcription=result["text"].strip(),
            confidence=overall_confidence,
            language=result.get("language", "unknown"),
            duration=duration,
            processing_time=processing_time,
            segments=segments
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        current_requests -= 1

@app.get("/models", response_model=List[ModelInfo])
async def get_models():
    """Get available Whisper models"""
    models = [
        ModelInfo(
            name="tiny",
            size="39 MB",
            languages=["en"],
            accuracy="Low",
            speed="Very Fast"
        ),
        ModelInfo(
            name="base",
            size="74 MB",
            languages=["en", "multilingual"],
            accuracy="Medium",
            speed="Fast"
        ),
        ModelInfo(
            name="small",
            size="244 MB",
            languages=["en", "multilingual"],
            accuracy="Medium-High",
            speed="Medium"
        ),
        ModelInfo(
            name="medium",
            size="769 MB",
            languages=["en", "multilingual"],
            accuracy="High",
            speed="Medium-Slow"
        ),
        ModelInfo(
            name="large",
            size="1550 MB",
            languages=["multilingual"],
            accuracy="Very High",
            speed="Slow"
        )
    ]
    return models

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    gpu_available = torch.cuda.is_available() if torch is not None else False
    model_loaded = len(whisper_models) > 0
    
    supported_formats = [
        "wav", "mp3", "mp4", "m4a", "flac", "ogg", "webm"
    ]
    
    return HealthResponse(
        status="healthy" if model_loaded else "loading",
        model_loaded=model_loaded,
        gpu_available=gpu_available,
        supported_formats=supported_formats
    )

@app.get("/status")
async def get_status():
    """Get detailed service status"""
    return {
        "service": "STT Service",
        "version": "1.0.0",
        "models_loaded": list(whisper_models.keys()),
        "models_loading": [k for k, v in model_loading.items() if v],
        "current_requests": current_requests,
        "max_concurrent_requests": MAX_CONCURRENT_REQUESTS,
        "device": get_device(),
        "temp_dir": TEMP_AUDIO_DIR,
        "max_audio_size_mb": MAX_AUDIO_SIZE / 1024 / 1024,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/preload-model")
async def preload_model(model_size: str):
    """Preload a specific Whisper model"""
    valid_models = ["tiny", "base", "small", "medium", "large"]
    
    if model_size not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model size. Must be one of: {valid_models}")
    
    try:
        await load_whisper_model(model_size)
        return {
            "success": True,
            "message": f"Model {model_size} loaded successfully",
            "model_size": model_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )