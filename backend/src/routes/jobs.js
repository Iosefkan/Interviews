import express from 'express';
import { authenticateHR, requireRole } from '../middleware/auth.js';
import Job from '../models/Job.js';
import Candidate from '../models/Candidate.js';
import InterviewSession from '../models/InterviewSession.js';

const router = express.Router();

// All job routes require HR authentication
router.use(authenticateHR);
router.use(requireRole('hr'));

// POST /api/jobs - Create a new job posting
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      requiredSkills
    } = req.body;

    // Validate required fields
    if (!title || !description || !requiredSkills || !Array.isArray(requiredSkills)) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and required skills (array) are required'
      });
    }

    if (requiredSkills.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one required skill must be specified'
      });
    }



    // Create job
    const job = new Job({
      title,
      description,
      requiredSkills: requiredSkills.map(skill => skill.trim()).filter(skill => skill),
      createdBy: req.user._id
    });

    await job.save();

    // Populate creator information
    await job.populate('createdBy', 'name email');

    console.log(`✅ Job created: ${title} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      job: {
        _id: job._id,
        title: job.title,
        description: job.description,
        requiredSkills: job.requiredSkills,
        status: job.status,
        statistics: job.statistics,
        createdBy: job.createdBy,
        createdAt: job.createdAt
      }
    });

  } catch (error) {
    console.error('Create job error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errorMessages.join('. ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create job. Please try again.'
    });
  }
});

// GET /api/jobs - Get all jobs with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    // By default, exclude closed jobs unless specifically requested
    if (status && ['active', 'inactive', 'closed'].includes(status)) {
      filter.status = status;
    } else {
      // If no status specified, exclude closed jobs
      filter.status = { $ne: 'closed' };
    }
    
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort
    };

    const result = await Job.getJobsWithStats(filter, options);

    res.json({
      success: true,
      jobs: result.jobs,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs. Please try again.'
    });
  }
});

// GET /api/jobs/:jobId - Get specific job with details
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId)
      .populate('createdBy', 'name email')
      .lean();
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Get updated statistics
    await Job.updateJobStatistics(jobId);
    
    // Refresh job data with updated statistics
    const updatedJob = await Job.findById(jobId)
      .populate('createdBy', 'name email')
      .lean();

    res.json({
      success: true,
      job: updatedJob
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job details. Please try again.'
    });
  }
});

// PUT /api/jobs/:jobId - Update job
router.put('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const updateData = req.body;

    // Find job and check ownership
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Check if user is the creator of the job
    if (job.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this job'
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.createdBy;
    delete updateData.candidates;
    delete updateData.statistics;



    // Update job
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    console.log(`✅ Job updated: ${updatedJob.title} by ${req.user.email}`);

    res.json({
      success: true,
      job: {
        _id: updatedJob._id,
        title: updatedJob.title,
        description: updatedJob.description,
        requiredSkills: updatedJob.requiredSkills,
        status: updatedJob.status,
        statistics: updatedJob.statistics,
        createdBy: updatedJob.createdBy,
        createdAt: updatedJob.createdAt,
        updatedAt: updatedJob.updatedAt
      }
    });

  } catch (error) {
    console.error('Update job error:', error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errorMessages.join('. ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update job. Please try again.'
    });
  }
});

// PATCH /api/jobs/:jobId/status - Update job status
router.patch('/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (active, inactive, or closed)'
      });
    }

    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Check ownership
    if (job.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this job'
      });
    }

    job.status = status;
    await job.save();

    console.log(`✅ Job status updated: ${job.title} -> ${status} by ${req.user.email}`);

    res.json({
      success: true,
      message: `Job status updated to ${status}`,
      job: {
        _id: job._id,
        title: job.title,
        status: job.status,
        updatedAt: job.updatedAt
      }
    });

  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job status. Please try again.'
    });
  }
});

// DELETE /api/jobs/:jobId - Delete job (soft delete by setting status to closed)
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Check ownership
    if (job.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this job'
      });
    }

    // Check if job has candidates
    const candidateCount = await Candidate.countDocuments({ jobId });
    
    if (candidateCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete job with ${candidateCount} candidate(s). Close the job instead.`
      });
    }

    // Soft delete by setting status to closed
    job.status = 'closed';
    await job.save();

    console.log(`✅ Job closed: ${job.title} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Job has been closed successfully'
    });

  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job. Please try again.'
    });
  }
});

// GET /api/jobs/:jobId/candidates - Get candidates for specific job
router.get('/:jobId/candidates', async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Check if job exists
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Build filter
    const filter = { jobId };
    
    if (status && ['pending', 'qualified', 'rejected', 'interviewed', 'hired', 'invited'].includes(status)) {
      filter.status = status;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const candidates = await Candidate.find(filter)
      .populate('interviewSessions', 'status evaluation.overallScore startTime endTime')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Candidate.countDocuments(filter);

    // Add interview status to each candidate
    const candidatesWithStatus = candidates.map(candidate => ({
      ...candidate,
      interviewStatus: Candidate.prototype.getInterviewStatus.call(candidate)
    }));

    res.json({
      success: true,
      candidates: candidatesWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      jobInfo: {
        title: job.title,
        status: job.status
      }
    });

  } catch (error) {
    console.error('Get job candidates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job candidates. Please try again.'
    });
  }
});

// GET /api/jobs/:jobId/statistics - Get detailed statistics for specific job
router.get('/:jobId/statistics', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Update statistics before returning
    await Job.updateJobStatistics(jobId);
    
    // Get fresh statistics
    const updatedJob = await Job.findById(jobId);
    
    // Get detailed candidate breakdown
    const candidateStats = await Candidate.aggregate([
      { $match: { jobId: job._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get interview completion rate
    const totalCandidates = await Candidate.countDocuments({ jobId });
    const invitedCandidates = await Candidate.countDocuments({ 
      jobId, 
      'interviewInvitation.sent': true 
    });
    
    const completedInterviews = await InterviewSession.countDocuments({
      candidateId: { $in: await Candidate.find({ jobId }).distinct('_id') },
      status: 'completed'
    });

    const stats = {
      basic: updatedJob.statistics,
      candidateBreakdown: candidateStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      invitationStats: {
        totalCandidates,
        invitedCandidates,
        completedInterviews,
        invitationRate: totalCandidates > 0 ? (invitedCandidates / totalCandidates * 100).toFixed(1) : '0',
        completionRate: invitedCandidates > 0 ? (completedInterviews / invitedCandidates * 100).toFixed(1) : '0'
      }
    };

    res.json({
      success: true,
      statistics: stats,
      jobTitle: updatedJob.title
    });

  } catch (error) {
    console.error('Get job statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job statistics. Please try again.'
    });
  }
});

export default router;