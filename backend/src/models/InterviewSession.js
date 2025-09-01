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
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
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
  skillsAssessment: {
    technical: [skillAssessmentSchema],
    soft: [skillAssessmentSchema]
  },
  strengths: [{
    type: String
  }],
  weaknesses: [{
    type: String
  }],
  recommendations: {
    type: String,
    enum: ['HIGHLY RECOMMEND', 'RECOMMEND', 'CONSIDER', 'NOT RECOMMEND']
  },
  aiNotes: {
    type: String
  },
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
  sessionKey: {
    type: String,
    required: true,
    unique: true
  },
  isPublicAccess: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  sessionType: {
    type: String,
    enum: ['technical', 'behavioral', 'mixed'],
    default: 'mixed'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'terminated', 'error', 'expired'],
    default: 'pending'
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
    },
    focusOnExperience: {
      type: Boolean,
      default: true
    }
  },
  accessLog: [{
    accessedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    action: {
      type: String,
      enum: ['started', 'resumed', 'completed', 'abandoned']
    }
  }],
  
  // Real-time features
  realTimeData: {
    webSocketSessionId: String,
    connectionStartTime: Date,
    lastActivityTime: Date,
    audioMetrics: {
      totalDuration: Number,
      averageVolume: Number,
      silencePeriods: [{ start: Date, end: Date }],
      qualityScore: Number
    },
    performanceMetrics: {
      averageResponseTime: Number,
      sttLatency: [Number],
      ttsLatency: [Number],
      aiProcessingTime: [Number]
    },
    interactionFlow: [{
      type: { type: String, enum: ['question', 'response', 'clarification', 'transition'] },
      startTime: Date,
      endTime: Date,
      content: String,
      metadata: Object
    }]
  },
  
  qualityAssurance: {
    audioQualityChecks: [{
      timestamp: Date,
      score: Number,
      issues: [String]
    }],
    connectionQuality: [{
      timestamp: Date,
      latency: Number,
      packetLoss: Number,
      bandwidth: Number
    }],
    userExperienceMetrics: {
      interactionSmoothness: Number,
      technicalIssues: Number,
      completionRate: Number
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
interviewSessionSchema.index({ candidateId: 1 });
interviewSessionSchema.index({ status: 1 });
interviewSessionSchema.index({ startTime: -1 });
interviewSessionSchema.index({ sessionKey: 1 });
interviewSessionSchema.index({ expiresAt: 1 });
interviewSessionSchema.index({ isPublicAccess: 1 });

// Calculate duration before saving
interviewSessionSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  
  // Auto-expire if past expiration date
  if (this.expiresAt && this.expiresAt < new Date() && this.status === 'pending') {
    this.status = 'expired';
  }
  
  next();
});

// Instance method to check if session is valid
interviewSessionSchema.methods.isValidSession = function() {
  return (
    this.sessionKey &&
    this.expiresAt &&
    this.expiresAt > new Date() &&
    ['pending', 'active'].includes(this.status)
  );
};

// Instance method to log access
interviewSessionSchema.methods.logAccess = function(action, ipAddress = null, userAgent = null) {
  this.accessLog.push({
    action,
    ipAddress,
    userAgent,
    accessedAt: new Date()
  });
  return this.save();
};

// Static method to find valid session by key
interviewSessionSchema.statics.findValidSession = function(sessionKey) {
  return this.findOne({
    sessionKey,
    expiresAt: { $gt: new Date() },
    status: { $in: ['pending', 'active'] }
  }).populate('candidateId', 'personalInfo jobInfo analysis');
};

// Static method to cleanup expired sessions
interviewSessionSchema.statics.cleanupExpiredSessions = async function() {
  try {
    const result = await this.updateMany(
      {
        expiresAt: { $lt: new Date() },
        status: { $in: ['pending', 'active'] }
      },
      { status: 'expired' }
    );
    
    console.log(`✅ Marked ${result.modifiedCount} interview sessions as expired`);
    return result;
  } catch (error) {
    console.error('❌ Error cleaning up expired sessions:', error);
    throw error;
  }
};

export default mongoose.model('InterviewSession', interviewSessionSchema);