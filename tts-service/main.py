from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, List
import torch
import os
import uuid
import asyncio
import logging
from datetime import datetime
import aiofiles
from dotenv import load_dotenv

# Import TTS components
try:
    from TTS.api import TTS
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False
    logging.warning("TTS library not available. Install with: pip install TTS")

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="TTS Service",
    description="Text-to-Speech service using XTTSv2",
    version="1.0.0"
)

# Configuration
AUDIO_OUTPUT_DIR = os.getenv("AUDIO_OUTPUT_DIR", "./audio")
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "1000"))
TTS_MODEL_NAME = os.getenv("TTS_MODEL_NAME", "tts_models/multilingual/multi-dataset/xtts_v2")
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "en")
TORCH_DEVICE = os.getenv("TORCH_DEVICE", "auto")
ENABLE_GPU = os.getenv("ENABLE_GPU", "true").lower() == "true"

# Global variables
tts_model = None
model_loading = False
model_loaded = False

# Ensure audio directory exists
os.makedirs(AUDIO_OUTPUT_DIR, exist_ok=True)

# Mount static files for audio serving
app.mount("/audio", StaticFiles(directory=AUDIO_OUTPUT_DIR), name="audio")

# Pydantic models
class VoiceSettings(BaseModel):
    speaker: Optional[str] = "default"
    speed: Optional[float] = Field(default=1.0, ge=0.5, le=2.0)
    emotion: Optional[str] = Field(default="neutral", regex="^(neutral|professional|friendly|excited)$")

class TTSRequest(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_LENGTH)
    voice_settings: Optional[VoiceSettings] = VoiceSettings()
    audio_format: Optional[str] = Field(default="wav", regex="^(wav|mp3)$")

class TTSResponse(BaseModel):
    audio_url: str
    duration: Optional[float] = None
    file_size: int
    status: str
    message: str

class VoiceInfo(BaseModel):
    id: str
    name: str
    language: str
    gender: str
    description: str

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    gpu_available: bool
    memory_usage: Optional[str] = None

async def load_tts_model():
    """Load the TTS model asynchronously"""
    global tts_model, model_loading, model_loaded
    
    if model_loaded or model_loading:
        return
    
    model_loading = True
    logger.info("Loading TTS model...")
    
    try:
        if not TTS_AVAILABLE:
            raise Exception("TTS library not available")
        
        # Determine device
        if TORCH_DEVICE == "auto":
            device = "cuda" if torch.cuda.is_available() and ENABLE_GPU else "cpu"
        else:
            device = TORCH_DEVICE
        
        logger.info(f"Using device: {device}")
        
        # Load model
        tts_model = TTS(TTS_MODEL_NAME).to(device)
        model_loaded = True
        logger.info("TTS model loaded successfully")
        
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        raise e
    finally:
        model_loading = False

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    logger.info("Starting TTS Service...")
    try:
        await load_tts_model()
    except Exception as e:
        logger.error(f"Failed to initialize TTS service: {e}")

async def cleanup_old_files():
    """Background task to clean up old audio files"""
    try:
        import time
        current_time = time.time()
        for filename in os.listdir(AUDIO_OUTPUT_DIR):
            file_path = os.path.join(AUDIO_OUTPUT_DIR, filename)
            if os.path.isfile(file_path):
                file_age = current_time - os.path.getctime(file_path)
                # Remove files older than 1 hour
                if file_age > 3600:
                    os.remove(file_path)
                    logger.info(f"Cleaned up old file: {filename}")
    except Exception as e:
        logger.error(f"Error cleaning up files: {e}")

@app.post("/generate-speech", response_model=TTSResponse)
async def generate_speech(request: TTSRequest, background_tasks: BackgroundTasks):
    """Generate speech from text using XTTSv2"""
    global tts_model
    
    if not model_loaded or tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")
    
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        filename = f"tts_{file_id}.{request.audio_format}"
        output_path = os.path.join(AUDIO_OUTPUT_DIR, filename)
        
        # Clean text
        clean_text = request.text.strip()
        
        # Generate speech
        logger.info(f"Generating speech for text: {clean_text[:50]}...")
        
        # Use default speaker for now (can be enhanced with custom speakers)
        tts_model.tts_to_file(
            text=clean_text,
            file_path=output_path,
            language=DEFAULT_LANGUAGE
        )
        
        # Get file size
        file_size = os.path.getsize(output_path)
        
        # Calculate duration (rough estimate)
        # Assuming average speaking rate of 150 words per minute
        word_count = len(clean_text.split())
        estimated_duration = (word_count / 150) * 60  # in seconds
        
        # Schedule cleanup
        background_tasks.add_task(cleanup_old_files)
        
        return TTSResponse(
            audio_url=f"/audio/{filename}",
            duration=estimated_duration,
            file_size=file_size,
            status="success",
            message="Speech generated successfully"
        )
        
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate speech: {str(e)}")

@app.get("/voices", response_model=List[VoiceInfo])
async def get_voices():
    """Get available voice models"""
    # For now, return default voices (can be enhanced with actual voice list)
    voices = [
        VoiceInfo(
            id="default",
            name="Default Voice",
            language="en",
            gender="neutral",
            description="Default XTTSv2 voice"
        ),
        VoiceInfo(
            id="professional",
            name="Professional Voice",
            language="en",
            gender="neutral",
            description="Professional tone for business communications"
        )
    ]
    return voices

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    gpu_available = torch.cuda.is_available() if torch.is not None else False
    
    memory_info = None
    if torch is not None and gpu_available:
        try:
            memory_info = f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB"
        except:
            memory_info = "Unknown"
    
    return HealthResponse(
        status="healthy" if model_loaded else "loading",
        model_loaded=model_loaded,
        gpu_available=gpu_available,
        memory_usage=memory_info
    )

@app.get("/status")
async def get_status():
    """Get detailed service status"""
    return {
        "service": "TTS Service",
        "version": "1.0.0",
        "model_name": TTS_MODEL_NAME,
        "model_loaded": model_loaded,
        "model_loading": model_loading,
        "device": "cuda" if torch.cuda.is_available() and ENABLE_GPU else "cpu",
        "audio_output_dir": AUDIO_OUTPUT_DIR,
        "max_text_length": MAX_TEXT_LENGTH,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/audio/{filename}")
async def get_audio_file(filename: str):
    """Serve audio files"""
    file_path = os.path.join(AUDIO_OUTPUT_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(file_path, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )