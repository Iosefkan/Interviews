import express from 'express';
import { uploadCV } from '../middleware/upload.js';
import { authenticateHR } from '../middleware/auth.js';
import cvService from '../services/cvService.js';
import openRouterService from '../services/openRouterService.js';
import Candidate from '../models/Candidate.js';
import Job from '../models/Job.js';
import InterviewSession from '../models/InterviewSession.js';
import reportService from '../services/reportService.js';
import fs from 'fs/promises';

const router = express.Router();

// All CV routes require HR authentication
router.use(authenticateHR);

// Upload and analyze CV for a specific job
router.post('/upload/:jobId', uploadCV, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Validate job exists and is active
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (job.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot upload CV to inactive job'
      });
    }

    // Check application deadline
    if (job.applicationDeadline && job.applicationDeadline < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Application deadline has passed'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No CV file uploaded'
      });
    }

    // Validate the uploaded file
    await cvService.validateCVFile(req.file.path);

    // Extract text from PDF
    const extractedData = await cvService.extractTextFromPdf(req.file.path);
    
    // Extract personal information
    const personalInfo = await cvService.extractPersonalInfo(extractedData.text);
    
    // Ensure we have the preferred language from either source
    const preferredLanguage = personalInfo.preferredLanguage || extractedData.language || 'ru';
    console.log(`🌍 Detected preferred language: ${preferredLanguage}`);

    // If no name found using regex patterns, try AI extraction as fallback
    if (!personalInfo.name && personalInfo.email) {
      try {
        const aiPersonalInfo = await openRouterService.extractPersonalInfo(extractedData.text);
        if (aiPersonalInfo && aiPersonalInfo.name) {
          personalInfo.name = aiPersonalInfo.name;
          console.log(`✅ AI fallback extracted name: ${personalInfo.name}`);
        }
      } catch (aiError) {
        console.log('❌ AI fallback failed for name extraction:', aiError.message);
      }
    }

    // If no name or email found, return error
    if (!personalInfo.name && !personalInfo.email) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract personal information from CV. Please ensure the CV contains name and email.'
      });
    }

    // Check if candidate with same email already exists for this job
    const existingCandidate = await Candidate.findOne({
      jobId,
      'personalInfo.email': personalInfo.email
    });

    if (existingCandidate) {
      return res.status(400).json({
        success: false,
        error: 'A candidate with this email has already applied for this job'
      });
    }

    // Analyze CV using AI with job-specific context
    const aiAnalysis = await openRouterService.analyzeCv(
      extractedData.text, 
      job.description, 
      job.title
    );

    // Parse and validate AI response
    const analysis = cvService.parseAnalysisResult(aiAnalysis);

    // Create candidate record with job association
    const candidate = new Candidate({
      jobId: job._id,
      personalInfo: {
        name: personalInfo.name || 'Unknown',
        email: personalInfo.email || 'unknown@example.com',
        phone: personalInfo.phone,
        preferredLanguage: preferredLanguage // Use detected language
      },
      cvFile: {
        originalName: req.file.originalname,
        filePath: req.file.path,
        uploadDate: new Date()
      },
      jobInfo: {
        title: job.title,
        description: job.description
      },
      analysis: analysis,
      status: analysis.qualified ? 'qualified' : 'rejected'
    });

    await candidate.save();

    // Add candidate to job's candidates array
    job.candidates.push(candidate._id);
    await job.save();

    // Update job statistics
    await Job.updateJobStatistics(jobId);

    console.log(`✅ CV uploaded for job ${job.title}: ${candidate.personalInfo.name} (${analysis.qualified ? 'qualified' : 'rejected'})`);

    res.json({
      success: true,
      candidateId: candidate._id,
      jobId: job._id,
      qualified: analysis.qualified,
      qualificationScore: analysis.qualificationScore,
      extractedSkills: analysis.extractedData.skills,
      experience: analysis.extractedData.experience,
      aiNotes: analysis.aiNotes,
      nextStep: analysis.qualified ? 'interview' : 'rejected',
      jobTitle: job.title
    });

  } catch (error) {
    console.error('CV upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get CV analysis results
router.get('/analysis/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    
    const candidate = await Candidate.findById(candidateId)
      .populate('jobId', 'title description requiredSkills status')
      .populate('interviewSessions', 'status evaluation startTime endTime');
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      candidateId: candidate._id,
      personalInfo: candidate.personalInfo,
      jobInfo: {
        ...candidate.jobInfo,
        jobId: candidate.jobId._id,
        status: candidate.jobId.status
      },
      analysisResults: candidate.analysis,
      status: candidate.status,
      interviewStatus: candidate.getInterviewStatus(),
      interviewSessions: candidate.interviewSessions,
      timestamp: candidate.createdAt
    });

  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all candidates (with pagination and job filtering)
router.get('/candidates', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const jobId = req.query.jobId;
    const skip = (page - 1) * limit;

    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (jobId) {
      filter.jobId = jobId;
    }

    const candidates = await Candidate.find(filter)
      .populate('jobId', 'title status')
      .populate('interviewSessions', 'status evaluation.overallScore startTime endTime')
      .select('-analysis.aiNotes -cvFile.filePath') // Exclude large fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Candidate.countDocuments(filter);

    // Add interview status to each candidate
    const candidatesWithStatus = candidates.map(candidate => ({
      ...candidate.toObject(),
      interviewStatus: candidate.getInterviewStatus()
    }));

    res.json({
      success: true,
      candidates: candidatesWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download CV file
router.get('/download/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    
    const candidate = await Candidate.findById(candidateId);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    const cvFilePath = candidate.cvFile.filePath;
    const originalName = candidate.cvFile.originalName;
    
    // Check if file exists
    try {
      await fs.access(cvFilePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'CV file not found on server'
      });
    }

    // Create a meaningful filename: CandidateName_JobTitle_Date.pdf
    // Sanitize and ensure we have valid values
    const sanitizeName = (name) => {
      if (!name || name.trim() === '') return 'Unknown';
      return name.trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    };
    
    const candidateName = sanitizeName(candidate.personalInfo.name) || 'Unknown_Candidate';
    const jobTitle = sanitizeName(candidate.jobInfo.title) || 'Unknown_Job';
    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '_'); // Format: YYYY_MM_DD
    const meaningfulFilename = `${candidateName}_${jobTitle}_${currentDate}.pdf`;
    
    // Set proper headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${meaningfulFilename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    
    // Send the file
    res.sendFile(cvFilePath, { root: process.cwd() }, (err) => {
      if (err) {
        console.error('Error sending CV file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to download CV file'
          });
        }
      }
    });

  } catch (error) {
    console.error('Download CV error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate CV analysis report
router.get('/report/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    
    const candidate = await Candidate.findById(candidateId);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    const report = await reportService.generateCVAnalysisReport(candidate);
    
    res.json({
      success: true,
      reportUrl: `/reports/${report.fileName}`,
      fileName: report.fileName,
      generatedAt: report.generatedAt
    });

  } catch (error) {
    console.error('Generate CV report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update candidate status
router.patch('/candidate/:candidateId/status', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'qualified', 'rejected', 'interviewed', 'hired'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const candidate = await Candidate.findByIdAndUpdate(
      candidateId,
      { status },
      { new: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      candidate: {
        id: candidate._id,
        status: candidate.status,
        updatedAt: candidate.updatedAt
      }
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Hard delete candidate (prevents multiple key errors)
router.delete('/candidate/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;

    // Find candidate first to get associated data
    const candidate = await Candidate.findById(candidateId);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    // Store jobId for statistics update
    const jobId = candidate.jobId;
    const candidateName = candidate.personalInfo.name;
    const cvFilePath = candidate.cvFile.filePath;

    // 1. Find all related interview sessions before deleting them
    const interviewSessions = await InterviewSession.find({ candidateId: candidateId });
    
    // 2. Delete PDF report files from filesystem (if they exist)
    for (const session of interviewSessions) {
      if (session.pdfReport && session.pdfReport.filePath) {
        try {
          await fs.unlink(session.pdfReport.filePath);
          console.log(`✅ Deleted interview report file: ${session.pdfReport.filePath}`);
        } catch (fileError) {
          console.log(`⚠️ Interview report file not found or already deleted: ${session.pdfReport.filePath}`);
          // Continue with deletion even if file doesn't exist
        }
      }
    }

    // 3. Delete all related interview sessions (hard delete)
    await InterviewSession.deleteMany({ candidateId: candidateId });
    console.log(`✅ Deleted interview sessions for candidate ${candidateName}`);

    // 4. Remove candidate from job's candidates array
    await Job.findByIdAndUpdate(
      jobId,
      { $pull: { candidates: candidateId } }
    );
    console.log(`✅ Removed candidate ${candidateName} from job candidates array`);

    // 5. Delete CV file from filesystem (if exists)
    try {
      if (cvFilePath) {
        await fs.unlink(cvFilePath);
        console.log(`✅ Deleted CV file: ${cvFilePath}`);
      }
    } catch (fileError) {
      console.log(`⚠️ CV file not found or already deleted: ${cvFilePath}`);
      // Continue with deletion even if file doesn't exist
    }

    // 6. Hard delete the candidate record
    await Candidate.findByIdAndDelete(candidateId);
    console.log(`✅ Hard deleted candidate: ${candidateName}`);

    // 7. Update job statistics
    await Job.updateJobStatistics(jobId);
    console.log(`✅ Updated job statistics after candidate deletion`);

    res.json({
      success: true,
      message: `Candidate ${candidateName} has been permanently deleted`,
      deletedCandidateId: candidateId,
      deletedAssociations: {
        interviewSessions: true,
        cvFile: true,
        jobAssociation: true
      }
    });

  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete candidate. Please try again.',
      details: error.message
    });
  }
});

export default router;