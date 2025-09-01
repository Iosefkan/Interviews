import mongoose from 'mongoose';

const audioFileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  duration: {
    type: Number // in seconds
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const interviewMessageSchema = new mongoose.Schema({
  speaker: {
    type: String,
    enum: ['ai', 'candidate'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  audioFile: audioFileSchema,
  timestamp: {
    type: Date,
    default: Date.now
  },
  questionCategory: {
    type: String,
    enum: ['technical', 'behavioral', 'clarification', 'general']
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1 // STT confidence score
  }
}, { _id: false });

const skillAssessmentSchema = new mongoose.Schema({
  skill: {
    type: String,
    required: true
  },
  claimed: {
    type: Boolean,
    required: true // Was this skill claimed in CV?
  },
  verified: {
    type: Boolean,
    required: true // Was this skill verified during interview?
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  evidence: {
    type: String // AI notes on how this was assessed
  }
}, { _id: false });

const evaluationSchema = new mongoose.Schema({
  overallScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  skillsVerified: [skillAssessmentSchema],
  communicationScore: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  strengths: [{
    type: String
  }],
  weaknesses: [{
    type: String
  }],
  recommendations: {
    type: String
  },
  aiNotes: {
    type: String
  }
}, { _id: false });

const pdfReportSchema = new mongoose.Schema({
  filePath: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  fileSize: {
    type: Number
  }
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  sessionType: {
    type: String,
    enum: ['technical', 'behavioral', 'mixed'],
    default: 'mixed'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'terminated', 'error'],
    default: 'active'
  },
  transcript: [interviewMessageSchema],
  evaluation: evaluationSchema,
  pdfReport: pdfReportSchema,
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number // in seconds
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  questionsGenerated: [{
    type: String
  }],
  interviewSettings: {
    maxQuestions: {
      type: Number,
      default: 10
    },
    timeLimit: {
      type: Number,
      default: 3600 // 1 hour in seconds
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
interviewSessionSchema.index({ candidateId: 1 });
interviewSessionSchema.index({ status: 1 });
interviewSessionSchema.index({ startTime: -1 });

// Calculate duration before saving
interviewSessionSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

export default mongoose.model('InterviewSession', interviewSessionSchema);