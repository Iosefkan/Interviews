import mongoose from 'mongoose';

const workExperienceSchema = new mongoose.Schema({
  position: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  technologies: [{
    type: String
  }],
  responsibilities: [{
    type: String
  }]
}, { _id: false });

const educationSchema = new mongoose.Schema({
  degree: {
    type: String,
    required: true
  },
  institution: {
    type: String,
    required: true
  },
  year: {
    type: String
  },
  grade: {
    type: String
  }
}, { _id: false });

const cvAnalysisSchema = new mongoose.Schema({
  qualified: {
    type: Boolean,
    required: true
  },
  qualificationScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  extractedData: {
    skills: [{
      type: String
    }],
    experience: {
      totalYears: {
        type: Number,
        default: 0
      },
      positions: [workExperienceSchema],
      education: [educationSchema]
    },
    technologies: [{
      type: String
    }],
    certifications: [{
      type: String
    }]
  },
  aiNotes: {
    type: String,
    required: true
  },
  matchingCriteria: [{
    criterion: {
      type: String,
      required: true
    },
    met: {
      type: Boolean,
      required: true
    },
    evidence: {
      type: String
    }
  }],
  processedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const candidateSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  personalInfo: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'ru'],
      default: 'ru'
    }
  },
  cvFile: {
    originalName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  },
  jobInfo: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    }
  },
  analysis: cvAnalysisSchema,
  interviewInvitation: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date
    },
    sessionKey: {
      type: String,
      unique: true,
      sparse: true
    },
    expiresAt: {
      type: Date
    },
    interviewLink: {
      type: String
    },
    reminderSent: {
      type: Boolean,
      default: false
    }
  },
  interviewSessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewSession'
  }],
  status: {
    type: String,
    enum: ['pending', 'qualified', 'rejected', 'interviewed', 'hired', 'invited'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
candidateSchema.index({ 'personalInfo.email': 1 });
candidateSchema.index({ status: 1 });
candidateSchema.index({ createdAt: -1 });
candidateSchema.index({ jobId: 1 });
candidateSchema.index({ 'interviewInvitation.sessionKey': 1 });
candidateSchema.index({ 'interviewInvitation.expiresAt': 1 });

// Instance method to check if interview invitation is valid
candidateSchema.methods.isInvitationValid = function() {
  return (
    this.interviewInvitation &&
    this.interviewInvitation.sessionKey &&
    this.interviewInvitation.expiresAt &&
    this.interviewInvitation.expiresAt > new Date()
  );
};

// Instance method to get interview status
candidateSchema.methods.getInterviewStatus = function() {
  if (!this.interviewInvitation || !this.interviewInvitation.sent) {
    return 'not-invited';
  }
  
  if (this.interviewSessions && this.interviewSessions.length > 0) {
    return 'completed';
  }
  
  if (this.interviewInvitation.expiresAt && this.interviewInvitation.expiresAt < new Date()) {
    return 'expired';
  }
  
  return 'invited';
};

// Static method to find candidates by job
candidateSchema.statics.findByJob = function(jobId, options = {}) {
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 10;
  const skip = (page - 1) * limit;
  const sort = options.sort || { createdAt: -1 };
  
  return this.find({ jobId })
    .populate('interviewSessions', 'status evaluation.overallScore startTime endTime')
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

export default mongoose.model('Candidate', candidateSchema);