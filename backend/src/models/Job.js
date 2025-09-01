import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    minlength: [50, 'Job description must be at least 50 characters'],
    maxlength: [5000, 'Job description cannot be more than 5000 characters']
  },
  requiredSkills: [{
    type: String,
    required: true,
    trim: true
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'closed'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HRUser',
    required: true
  },
  candidates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate'
  }],
  experience: {
    min: {
      type: Number,
      min: 0,
      default: 0
    },
    max: {
      type: Number,
      min: 0
    }
  },
  statistics: {
    totalCandidates: {
      type: Number,
      default: 0
    },
    qualifiedCandidates: {
      type: Number,
      default: 0
    },
    completedInterviews: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    }
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
jobSchema.index({ createdBy: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ title: 'text', description: 'text' }); // Text search

// Validation for experience range
jobSchema.pre('save', function(next) {
  if (this.experience && this.experience.min && this.experience.max) {
    if (this.experience.min > this.experience.max) {
      return next(new Error('Minimum experience cannot be greater than maximum experience'));
    }
  }
  
  next();
});

// Instance method to get formatted experience range
jobSchema.methods.getFormattedExperienceRange = function() {
  if (!this.experience || (!this.experience.min && !this.experience.max)) {
    return 'Any level';
  }
  
  const min = this.experience.min || 0;
  const max = this.experience.max;
  
  if (max) {
    return `${min}-${max} years`;
  } else if (min > 0) {
    return `${min}+ years`;
  }
  
  return 'Entry level';
};

// Static method to get jobs with statistics
jobSchema.statics.getJobsWithStats = async function(filter = {}, options = {}) {
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 10;
  const skip = (page - 1) * limit;
  const sort = options.sort || { createdAt: -1 };
  
  const jobs = await this.find(filter)
    .populate('createdBy', 'name email')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
    
  const total = await this.countDocuments(filter);
  
  return {
    jobs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to update job statistics
jobSchema.statics.updateJobStatistics = async function(jobId) {
  try {
    const Candidate = mongoose.model('Candidate');
    const InterviewSession = mongoose.model('InterviewSession');
    
    const candidates = await Candidate.find({ jobId: jobId });
    const totalCandidates = candidates.length;
    const qualifiedCandidates = candidates.filter(c => c.analysis && c.analysis.qualified).length;
    
    const completedInterviews = await InterviewSession.countDocuments({
      candidateId: { $in: candidates.map(c => c._id) },
      status: 'completed'
    });
    
    const interviewSessions = await InterviewSession.find({
      candidateId: { $in: candidates.map(c => c._id) },
      status: 'completed',
      'evaluation.overallScore': { $exists: true }
    });
    
    const averageScore = interviewSessions.length > 0
      ? interviewSessions.reduce((sum, session) => sum + session.evaluation.overallScore, 0) / interviewSessions.length
      : 0;
    
    await this.findByIdAndUpdate(jobId, {
      'statistics.totalCandidates': totalCandidates,
      'statistics.qualifiedCandidates': qualifiedCandidates,
      'statistics.completedInterviews': completedInterviews,
      'statistics.averageScore': Math.round(averageScore * 100) / 100
    });
    
  } catch (error) {
    console.error('Error updating job statistics:', error);
  }
};

export default mongoose.model('Job', jobSchema);