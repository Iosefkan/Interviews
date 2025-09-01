import express from 'express';
import { uploadAudio } from '../middleware/upload.js';
import { authenticateHR, validateSessionKey } from '../middleware/auth.js';
import InterviewSession from '../models/InterviewSession.js';
import Candidate from '../models/Candidate.js';
import Job from '../models/Job.js';
import openRouterService from '../services/openRouterService.js';
import audioService from '../services/audioService.js';
import reportService from '../services/reportService.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Health check endpoint for audio services
router.get('/health/audio', async (req, res) => {
  try {
    const ttsHealth = await audioService.checkTtsHealth();
    const sttHealth = await audioService.checkSttHealth();
    
    res.json({
      success: true,
      services: {
        tts: ttsHealth,
        stt: sttHealth
      }
    });
  } catch (error) {
    console.error('Audio services health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check audio services health'
    });
  }
});

// Send interview invitation (requires HR authentication)
router.post('/invite/:candidateId', authenticateHR, async (req, res) => {
  try {
    const { candidateId } = req.params;

    // Find candidate and check if qualified
    const candidate = await Candidate.findById(candidateId)
      .populate('jobId', 'title description requiredSkills status');
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    // Check if candidate is qualified for interview
    if (!candidate.analysis?.qualified) {
      return res.status(400).json({
        success: false,
        error: 'Candidate is not qualified for interview'
      });
    }

    // Check if job is still active
    if (candidate.jobId.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot invite candidate for inactive job'
      });
    }

    // Check if invitation already sent
    if (candidate.interviewInvitation && candidate.interviewInvitation.sent) {
      return res.status(400).json({
        success: false,
        error: 'Interview invitation already sent to this candidate',
        sessionKey: candidate.interviewInvitation.sessionKey,
        sentAt: candidate.interviewInvitation.sentAt,
        expiresAt: candidate.interviewInvitation.expiresAt
      });
    }

    // Generate session key and expiration (1 week from now)
    const sessionKey = emailService.generateSessionKey();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 1 week expiry
    
    const interviewLink = emailService.createInterviewLink(sessionKey);

    // Update candidate with invitation details
    candidate.interviewInvitation = {
      sent: true,
      sentAt: new Date(),
      sessionKey,
      expiresAt,
      interviewLink,
      reminderSent: false
    };
    candidate.status = 'invited';
    await candidate.save();

    // Send email invitation
    try {
      const emailResult = await emailService.sendInterviewInvitation(
        candidate,
        {
          sessionKey,
          expiresAt,
          interviewLink
        }
      );

      console.log(`✅ Interview invitation sent to ${candidate.personalInfo.name} (${candidate.personalInfo.email})`);

      // Update job statistics
      await Job.updateJobStatistics(candidate.jobId._id);

      res.json({
        success: true,
        invitationSent: true,
        sessionKey,
        expiresAt,
        interviewLink,
        emailMessageId: emailResult.messageId,
        candidateName: candidate.personalInfo.name,
        candidateEmail: candidate.personalInfo.email
      });

    } catch (emailError) {
      // Rollback invitation data if email fails
      candidate.interviewInvitation = {
        sent: false,
        sentAt: null,
        sessionKey: null,
        expiresAt: null,
        interviewLink: null
      };
      candidate.status = 'qualified';
      await candidate.save();

      console.error('❌ Failed to send invitation email:', emailError.message);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to send invitation email. Please check email configuration.',
        details: emailError.message
      });
    }

  } catch (error) {
    console.error('Interview invitation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send interview invitation. Please try again.'
    });
  }
});

// Public endpoint to start interview with session key
router.post('/start-public', validateSessionKey, async (req, res) => {
  try {
    const { candidate, sessionKey } = req;
    const { interviewType = 'mixed' } = req.body;

    // Check if candidate already has an active interview session
    const existingSession = await InterviewSession.findOne({
      candidateId: candidate._id,
      status: { $in: ['pending', 'active'] },
      sessionKey
    });

    if (existingSession) {
      // Resume existing session
      const currentQuestionIndex = existingSession.currentQuestionIndex;
      const currentQuestion = existingSession.questionsGenerated[currentQuestionIndex];
      
      // Get existing audio URL if available
      let existingAudioUrl = null;
      const lastAIEntry = existingSession.transcript
        .filter(entry => entry.speaker === 'ai')
        .pop();
      
      // Log access
      await existingSession.logAccess('resumed', req.ip, req.get('User-Agent'));
      
      return res.json({
        success: true,
        sessionId: existingSession._id,
        isResuming: true,
        currentQuestion,
        currentQuestionAudio: existingAudioUrl,
        currentQuestionIndex,
        totalQuestions: existingSession.questionsGenerated.length,
        candidateInfo: {
          name: candidate.personalInfo.name,
          jobTitle: candidate.jobInfo.title
        }
      });
    }

    // Generate experience-focused interview questions
    const questions = await openRouterService.generateInterviewQuestions(candidate, interviewType);

    // Create new interview session
    const session = new InterviewSession({
      candidateId: candidate._id,
      sessionKey,
      isPublicAccess: true,
      expiresAt: candidate.interviewInvitation.expiresAt,
      sessionType: interviewType,
      status: 'pending', // Will become 'active' when first question is answered
      questionsGenerated: questions.map(q => q.question),
      interviewSettings: {
        maxQuestions: questions.length,
        timeLimit: 3600, // 1 hour
        focusOnExperience: true
      },
      transcript: [],
      accessLog: [{
        action: 'started',
        accessedAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }]
    });

    await session.save();

    // Add session to candidate's interview sessions
    candidate.interviewSessions.push(session._id);
    await candidate.save();

    // Generate first question audio in the candidate's preferred language
    let firstQuestionAudio = null;
    const firstQuestion = questions[0]?.question;
    
    if (firstQuestion) {
      try {
        // Detect language from candidate preferences
        let interviewLanguage = candidate.personalInfo?.preferredLanguage || 'ru';
        
        // Create welcome message based on detected language
        let welcomeMessage = '';
        if (interviewLanguage === 'ru') {
          welcomeMessage = `Здравствуйте, ${candidate.personalInfo.name}, добро пожаловать на собеседование на позицию ${candidate.jobInfo.title}. ${firstQuestion}`;
        } else {
          // Default to English
          welcomeMessage = `Hello ${candidate.personalInfo.name}, welcome to your interview for the ${candidate.jobInfo.title} position. ${firstQuestion}`;
        }
        
        console.log(`Generating TTS for first question in language: ${interviewLanguage}`);
        const audioResponse = await audioService.generateSpeech(welcomeMessage, {
          emotion: 'professional',
          speed: 1.0,
          language: interviewLanguage // Pass detected language
        });
        firstQuestionAudio = audioResponse.audio_url;
        console.log(`Successfully generated TTS audio: ${firstQuestionAudio}`);

        // Add first question to transcript
        session.transcript.push({
          speaker: 'ai',
          content: welcomeMessage, // Use the full welcome message
          timestamp: new Date(),
          questionCategory: questions[0].category
        });
        await session.save();
      } catch (audioError) {
        console.error('Audio generation error:', audioError);
        // Log additional details for debugging
        console.error('Audio generation error details:', {
          message: audioError.message,
          stack: audioError.stack,
          candidateId: candidate._id,
          preferredLanguage: candidate.personalInfo?.preferredLanguage
        });
        // Continue without audio if TTS fails
      }
    }

    console.log(`✅ Interview session started for ${candidate.personalInfo.name} with session key ${sessionKey}`);

    res.json({
      success: true,
      sessionId: session._id,
      candidateInfo: {
        name: candidate.personalInfo.name,
        jobTitle: candidate.jobInfo.title
      },
      firstQuestion,
      firstQuestionAudio,
      totalQuestions: questions.length,
      estimatedDuration: Math.ceil(questions.length * 3) // 3 minutes per question
    });

  } catch (error) {
    console.error('Start public interview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start interview. Please try again or contact HR for assistance.'
    });
  }
});

// Process audio input during interview (supports both HR and public access)
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
    const session = await InterviewSession.findById(sessionId)
      .populate('candidateId');
      
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interview session not found'
      });
    }

    // Check session validity (for public access)
    if (session.isPublicAccess && !session.isValidSession()) {
      return res.status(400).json({
        success: false,
        error: 'Interview session has expired. Please contact HR for assistance.'
      });
    }

    if (!['pending', 'active'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        error: 'Interview session is not active'
      });
    }

    // Set session to active if it's the first response
    if (session.status === 'pending') {
      session.status = 'active';
      session.startTime = new Date();
    }

    // Detect language from session or default to Russian
    let transcriptionLanguage = session.candidateId?.personalInfo?.preferredLanguage || 'ru';

    // Transcribe audio with detected language
    const transcriptionResult = await audioService.transcribeAudio(req.file.buffer, {
      language: transcriptionLanguage,
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

    // Get candidate's preferred language
    const candidateLanguage = session.candidateId?.personalInfo?.preferredLanguage || 'ru';

    if (evaluation.followUp && evaluation.shouldContinue) {
      // Ask follow-up question
      nextQuestion = evaluation.followUp;
      
      // Customize follow-up response based on candidate's preferred language
      if (candidateLanguage === 'ru') {
        aiResponse = `Позвольте мне задать уточняющий вопрос. ${evaluation.followUp}`;
      } else {
        // Default to English
        aiResponse = `Let me ask a follow-up question. ${evaluation.followUp}`;
      }
    } else if (session.currentQuestionIndex + 1 < session.questionsGenerated.length) {
      // Move to next question
      session.currentQuestionIndex += 1;
      nextQuestion = session.questionsGenerated[session.currentQuestionIndex];
      
      // Customize response based on candidate's preferred language
      if (candidateLanguage === 'ru') {
        aiResponse = `Спасибо за ваш ответ. ${nextQuestion}`;
      } else {
        // Default to English
        aiResponse = `Thank you for your answer. ${nextQuestion}`;
      }
    } else {
      // Interview is complete
      isInterviewComplete = true;
      
      // Customize completion message based on candidate's preferred language
      if (candidateLanguage === 'ru') {
        aiResponse = "Интервью завершено, спасибо за ваше время, мы свяжемся с вами позже";
      } else {
        // Default to English
        aiResponse = "Interview is now over, thank you for your time, we will contact you later";
      }
      
      session.status = 'completed';
      session.endTime = new Date();
    }

    // Generate AI response audio in the candidate's preferred language
    let audioResponseUrl = null;
    try {
      const audioResponse = await audioService.generateSpeech(aiResponse, {
        emotion: 'professional',
        speed: 1.0,
        language: candidateLanguage // Pass candidate's preferred language
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
          skillsAssessment: finalEvaluation.skillsAssessment,
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

// Get interview results (HR authenticated)
router.get('/results/:sessionId', authenticateHR, async (req, res) => {
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

// Generate and download PDF interview report (HR authenticated)
router.get('/report/:sessionId', authenticateHR, async (req, res) => {
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

// Get all interview sessions (HR authenticated)
router.get('/sessions', authenticateHR, async (req, res) => {
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