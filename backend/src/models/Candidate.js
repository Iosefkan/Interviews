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
  interviewSessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewSession'
  }],
  status: {
    type: String,
    enum: ['pending', 'qualified', 'rejected', 'interviewed', 'hired'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
candidateSchema.index({ 'personalInfo.email': 1 });
candidateSchema.index({ status: 1 });
candidateSchema.index({ createdAt: -1 });

export default mongoose.model('Candidate', candidateSchema);