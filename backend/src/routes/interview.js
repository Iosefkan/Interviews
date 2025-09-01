import express from 'express';
import { uploadAudio } from '../middleware/upload.js';
import InterviewSession from '../models/InterviewSession.js';
import Candidate from '../models/Candidate.js';
import openRouterService from '../services/openRouterService.js';
import audioService from '../services/audioService.js';
import reportService from '../services/reportService.js';

const router = express.Router();

// Start interview session
router.post('/start', async (req, res) => {
  try {
    const { candidateId, interviewType = 'mixed' } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: 'Candidate ID is required'
      });
    }

    // Find candidate
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    // Check if candidate is qualified
    if (!candidate.analysis?.qualified) {
      return res.status(400).json({
        success: false,
        error: 'Candidate is not qualified for interview'
      });
    }

    // Generate interview questions
    const questions = await openRouterService.generateInterviewQuestions(candidate, interviewType);

    // Create interview session
    const session = new InterviewSession({
      candidateId,
      sessionType: interviewType,
      status: 'active',
      questionsGenerated: questions.map(q => q.question),
      interviewSettings: {
        maxQuestions: questions.length,
        timeLimit: 3600 // 1 hour
      },
      transcript: []
    });

    await session.save();

    // Update candidate's interview sessions
    candidate.interviewSessions.push(session._id);
    candidate.status = 'interviewed';
    await candidate.save();

    // Generate first question audio
    let firstQuestionAudio = null;
    if (questions.length > 0) {
      try {
        const audioResponse = await audioService.generateSpeech(
          `Hello ${candidate.personalInfo.name}, welcome to your interview. ${questions[0].question}`,
          { emotion: 'professional', speed: 1.0 }
        );
        firstQuestionAudio = audioResponse.audio_url;

        // Add first question to transcript
        session.transcript.push({
          speaker: 'ai',
          content: questions[0].question,
          timestamp: new Date(),
          questionCategory: questions[0].category
        });
        await session.save();
      } catch (audioError) {
        console.error('Audio generation error:', audioError);
        // Continue without audio if TTS fails
      }
    }

    res.json({
      success: true,
      sessionId: session._id,
      interviewQuestions: questions,
      estimatedDuration: Math.ceil(questions.length * 3), // 3 minutes per question
      firstQuestionAudio,
      currentQuestion: questions[0]?.question
    });

  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process audio input during interview
router.post('/audio/process', uploadAudio, async (req, res) => {
  try {
    const { sessionId, questionId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded'
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    // Find interview session
    const session = await InterviewSession.findById(sessionId).populate('candidateId');
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interview session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Interview session is not active'
      });
    }

    // Transcribe audio
    const transcriptionResult = await audioService.transcribeAudio(req.file.buffer, {
      language: 'en',
      modelSize: 'base'
    });

    const transcription = transcriptionResult.transcription;
    const confidence = transcriptionResult.confidence;

    // Add candidate response to transcript
    session.transcript.push({
      speaker: 'candidate',
      content: transcription,
      timestamp: new Date(),
      confidence: confidence
    });

    // Get current question
    const currentQuestionIndex = session.currentQuestionIndex;
    const currentQuestion = session.questionsGenerated[currentQuestionIndex];

    // Evaluate response using AI
    const evaluation = await openRouterService.evaluateResponse(
      currentQuestion,
      transcription,
      session.candidateId
    );

    // Generate follow-up or next question
    let nextQuestion = null;
    let aiResponse = '';
    let isInterviewComplete = false;

    if (evaluation.followUp && evaluation.shouldContinue) {
      // Ask follow-up question
      aiResponse = evaluation.followUp;
      nextQuestion = evaluation.followUp;
    } else if (session.currentQuestionIndex + 1 < session.questionsGenerated.length) {
      // Move to next question
      session.currentQuestionIndex += 1;
      nextQuestion = session.questionsGenerated[session.currentQuestionIndex];
      aiResponse = `Thank you for your answer. ${nextQuestion}`;
    } else {
      // Interview is complete
      isInterviewComplete = true;
      aiResponse = 'Thank you for your time. The interview is now complete. We will review your responses and get back to you soon.';
      session.status = 'completed';
      session.endTime = new Date();
    }

    // Generate AI response audio
    let audioResponseUrl = null;
    try {
      const audioResponse = await audioService.generateSpeech(aiResponse, {
        emotion: 'professional',
        speed: 1.0
      });
      audioResponseUrl = audioResponse.audio_url;
    } catch (audioError) {
      console.error('Audio generation error:', audioError);
      // Continue without audio if TTS fails
    }

    // Add AI response to transcript
    session.transcript.push({
      speaker: 'ai',
      content: aiResponse,
      timestamp: new Date(),
      questionCategory: isInterviewComplete ? 'general' : 'technical'
    });

    await session.save();

    // If interview is complete, generate final evaluation
    if (isInterviewComplete) {
      try {
        const finalEvaluation = await openRouterService.generateFinalEvaluation(session);
        
        // Update session with evaluation
        session.evaluation = {
          overallScore: finalEvaluation.overallScore,
          skillsVerified: [], // Will be populated from individual responses
          communicationScore: finalEvaluation.communicationScore,
          confidence: finalEvaluation.confidence,
          strengths: finalEvaluation.strengths,
          weaknesses: finalEvaluation.weaknesses,
          recommendations: finalEvaluation.recommendations,
          aiNotes: finalEvaluation.aiNotes
        };

        await session.save();
      } catch (evalError) {
        console.error('Final evaluation error:', evalError);
        // Continue without final evaluation if it fails
      }
    }

    res.json({
      success: true,
      transcription,
      confidence,
      aiResponse,
      audioResponseUrl,
      nextQuestion,
      isComplete: isInterviewComplete,
      evaluation: {
        score: evaluation.score,
        feedback: evaluation.feedback,
        skillsVerified: evaluation.skillsVerified
      }
    });

  } catch (error) {
    console.error('Process audio error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get interview results
router.get('/results/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await InterviewSession.findById(sessionId)
      .populate('candidateId', 'personalInfo jobInfo analysis');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interview session not found'
      });
    }

    res.json({
      success: true,
      sessionId: session._id,
      candidate: session.candidateId,
      status: session.status,
      duration: session.duration,
      overallScore: session.evaluation?.overallScore || 0,
      skillsAssessment: {
        technical: session.evaluation?.skillsVerified?.filter(s => s.skill) || [],
        soft: [], // Could be enhanced to separate soft skills
        communication: session.evaluation?.communicationScore || 0
      },
      recommendations: session.evaluation?.recommendations || '',
      transcript: session.transcript,
      evaluation: session.evaluation,
      startTime: session.startTime,
      endTime: session.endTime
    });

  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate and download PDF interview report
router.get('/report/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await InterviewSession.findById(sessionId)
      .populate('candidateId');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interview session not found'
      });
    }

    // Generate PDF report if not already generated
    if (!session.pdfReport) {
      const report = await reportService.generateInterviewReport(session, session.candidateId);
      
      session.pdfReport = report;
      await session.save();
    }

    res.json({
      success: true,
      reportUrl: `/reports/${session.pdfReport.fileName}`,
      fileName: session.pdfReport.fileName,
      generatedAt: session.pdfReport.generatedAt
    });

  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Terminate interview session
router.post('/terminate/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await InterviewSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interview session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Interview session is not active'
      });
    }

    session.status = 'terminated';
    session.endTime = new Date();
    await session.save();

    res.json({
      success: true,
      message: 'Interview session terminated',
      sessionId: session._id,
      endTime: session.endTime
    });

  } catch (error) {
    console.error('Terminate interview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all interview sessions (with pagination)
router.get('/sessions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const sessions = await InterviewSession.find(filter)
      .populate('candidateId', 'personalInfo jobInfo')
      .select('-transcript') // Exclude large transcript field
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);

    const total = await InterviewSession.countDocuments(filter);

    res.json({
      success: true,
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;