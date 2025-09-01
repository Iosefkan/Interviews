from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List
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
TORCH_DEVICE = os.getenv("TORCH_DEVICE", "auto")
ENABLE_GPU = os.getenv("ENABLE_GPU", "true").lower() == "true"
MAX_CONCURRENT_REQUESTS = int(os.getenv("MAX_CONCURRENT_REQUESTS", "5"))

# Global variables
whisper_model = None
model_loading = False
current_requests = 0

# Ensure temp directory exists
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

# Pydantic models
class TranscriptionResponse(BaseModel):
    transcription: str
    language: str
    duration: float
    processing_time: float

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

async def load_whisper_model():
    """Load Whisper medium model"""
    global whisper_model, model_loading
    
    if whisper_model is not None:
        return whisper_model
    
    if model_loading:
        # Wait for model to finish loading
        while model_loading:
            await asyncio.sleep(0.1)
        return whisper_model
    
    model_loading = True
    logger.info("Loading Whisper medium model")
    
    try:
        device = get_device()
        model = whisper.load_model("medium", device=device)
        whisper_model = model
        logger.info(f"Whisper medium model loaded successfully on {device}")
        return model
    except Exception as e:
        logger.error(f"Failed to load Whisper medium model: {e}")
        raise e
    finally:
        model_loading = False

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    logger.info("Starting STT Service...")
    try:
        # Load medium model
        await load_whisper_model()
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
    audio: UploadFile = File(...)
):
    """Transcribe audio using OpenAI Whisper medium model"""
    global current_requests
    
    # Check concurrent request limit
    if current_requests >= MAX_CONCURRENT_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many concurrent requests")
    
    current_requests += 1
    start_time = datetime.now()
    
    try:
        # Validate file size
        if audio.size and audio.size > MAX_AUDIO_SIZE:
            raise HTTPException(status_code=413, detail="Audio file too medium")
        
        # Load medium model
        model = await load_whisper_model()
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
        
        # Transcribe audio with medium model
        logger.info("Transcribing audio with medium model...")
        
        result = model.transcribe(audio_path)
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        
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
            language=result.get("language", "unknown"),
            duration=duration,
            processing_time=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        current_requests -= 1

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    gpu_available = torch.cuda.is_available() if torch is not None else False
    model_loaded = whisper_model is not None
    
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
        "model_loaded": whisper_model is not None,
        "current_requests": current_requests,
        "max_concurrent_requests": MAX_CONCURRENT_REQUESTS,
        "device": get_device(),
        "temp_dir": TEMP_AUDIO_DIR,
        "max_audio_size_mb": MAX_AUDIO_SIZE / 1024 / 1024,
        "timestamp": datetime.now().isoformat()
    }

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