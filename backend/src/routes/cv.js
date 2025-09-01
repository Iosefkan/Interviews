import express from 'express';
import { uploadCV } from '../middleware/upload.js';
import cvService from '../services/cvService.js';
import openRouterService from '../services/openRouterService.js';
import Candidate from '../models/Candidate.js';
import reportService from '../services/reportService.js';

const router = express.Router();

// Upload and analyze CV
router.post('/upload', uploadCV, async (req, res) => {
  try {
    const { jobDescription, jobTitle } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No CV file uploaded'
      });
    }

    if (!jobDescription || !jobTitle) {
      return res.status(400).json({
        success: false,
        error: 'Job description and job title are required'
      });
    }

    // Validate the uploaded file
    await cvService.validateCVFile(req.file.path);

    // Extract text from PDF
    const extractedData = await cvService.extractTextFromPdf(req.file.path);
    
    // Extract personal information
    const personalInfo = await cvService.extractPersonalInfo(extractedData.text);

    // If no name or email found, return error
    if (!personalInfo.name && !personalInfo.email) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract personal information from CV. Please ensure the CV contains name and email.'
      });
    }

    // Analyze CV using AI
    const aiAnalysis = await openRouterService.analyzeCv(
      extractedData.text, 
      jobDescription, 
      jobTitle
    );

    // Parse and validate AI response
    const analysis = cvService.parseAnalysisResult(aiAnalysis);

    // Create candidate record
    const candidate = new Candidate({
      personalInfo: {
        name: personalInfo.name || 'Unknown',
        email: personalInfo.email || 'unknown@example.com',
        phone: personalInfo.phone
      },
      cvFile: {
        originalName: req.file.originalname,
        filePath: req.file.path,
        uploadDate: new Date()
      },
      jobInfo: {
        title: jobTitle,
        description: jobDescription
      },
      analysis: analysis,
      status: analysis.qualified ? 'qualified' : 'rejected'
    });

    await candidate.save();

    res.json({
      success: true,
      candidateId: candidate._id,
      qualified: analysis.qualified,
      qualificationScore: analysis.qualificationScore,
      extractedSkills: analysis.extractedData.skills,
      experience: analysis.extractedData.experience,
      aiNotes: analysis.aiNotes,
      nextStep: analysis.qualified ? 'interview' : 'rejected'
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
    
    const candidate = await Candidate.findById(candidateId);
    
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
      jobInfo: candidate.jobInfo,
      analysisResults: candidate.analysis,
      status: candidate.status,
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

// Get all candidates (with pagination)
router.get('/candidates', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const candidates = await Candidate.find(filter)
      .select('-analysis.aiNotes -cvFile.filePath') // Exclude large fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Candidate.countDocuments(filter);

    res.json({
      success: true,
      candidates,
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

export default router;