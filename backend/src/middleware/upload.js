import multer from 'multer';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Storage configuration for CV uploads
const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `cv_${uuidv4()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Storage configuration for audio files
const audioStorage = multer.memoryStorage();

// File filter for CV uploads (only PDFs)
const cvFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for CV uploads'), false);
  }
};

// File filter for audio uploads
const audioFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/webm',
    'audio/ogg',
    'audio/m4a'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

// Upload middleware for CVs
export const uploadCV = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  }
}).single('cv');

// Upload middleware for audio files
export const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for audio files
  }
}).single('audio');