import { WebSocketServer } from 'ws';
import InterviewSession from '../models/InterviewSession.js';
import audioService from './audioService.js';
import openRouterService from './openRouterService.js';

class SimpleWebSocketService {
  constructor() {
    this.wss = null;
    this.connections = new Map(); // sessionId -> WebSocket connection
    this.audioBuffers = new Map(); // sessionId -> buffered audio data
  }

  initialize(port) {
    this.wss = new WebSocketServer({ 
      port,
      path: '/ws/interview'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('✅ Simplified WebSocket server initialized on /ws/interview');
  }

  async validateSession(sessionId, sessionKey) {
    try {
      const session = await InterviewSession.findById(sessionId);

      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        return { valid: false, reason: 'Session expired' };
      }

      // For public access, validate session key
      if (session.isPublicAccess) {
        if (!sessionKey) {
          return { valid: false, reason: 'Session key required' };
        }
        
        if (session.sessionKey !== sessionKey) {
          return { valid: false, reason: 'Invalid session key' };
        }
      }

      return { valid: true, session };
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }
  
  async handleConnection(ws, request) {
    // Extract session parameters
    const url = new URL(request.url, `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const sessionKey = url.searchParams.get('sessionKey');
    
    console.log(`New WebSocket connection attempt for session ${sessionId}`);
    
    // Validate session
    const validation = await this.validateSession(sessionId, sessionKey);
    if (!validation.valid) {
      console.log(`Session validation failed: ${validation.reason}`);
      ws.close(4001, validation.reason);
      return;
    }
    
    const session = validation.session;
    
    // Close existing connection if one exists
    if (this.connections.has(sessionId)) {
      console.log(`Closing existing connection for session ${sessionId}`);
      this.connections.get(sessionId).close(4002, 'New connection established');
    }
    
    // Store connection and preserve existing audio buffer
    this.connections.set(sessionId, ws);
    if (!this.audioBuffers.has(sessionId)) {
      console.log(`Initializing new audio buffer for session ${sessionId}`);
      this.audioBuffers.set(sessionId, []);
    } else {
      const existingBuffer = this.audioBuffers.get(sessionId);
      console.log(`Reusing existing audio buffer for session ${sessionId}, current buffer size: ${existingBuffer.length}`);
    }
    
    // Set up ping/pong
    ws.isAlive = true;
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }, 30000);
    
    // Set up event handlers
    ws.on('message', (data) => {
      this.handleMessage(sessionId, data);
    });
    
    ws.on('close', () => {
      clearInterval(pingInterval);
      this.handleDisconnection(sessionId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
      clearInterval(pingInterval);
      this.handleDisconnection(sessionId);
    });
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId: sessionId,
      message: 'WebSocket connection established successfully'
    }));
    
    // Send first question if this is a new session
    try {
      const interviewSession = await InterviewSession.findById(sessionId).populate('candidateId');
      if (interviewSession && interviewSession.transcript.length > 0) {
        // Find the first AI message in the transcript
        const firstAIEntry = interviewSession.transcript.find(entry => entry.speaker === 'ai');
        if (firstAIEntry) {
          // Get the audio URL for the first question if available
          let firstQuestionAudio = null;
          try {
            // Regenerate audio for the first question if needed
            const interviewLanguage = interviewSession.candidateId?.personalInfo?.preferredLanguage || 'en';
            const audioResponse = await audioService.generateSpeech(firstAIEntry.content, {
              emotion: 'professional',
              speed: 1.0,
              language: interviewLanguage
            });
            firstQuestionAudio = audioResponse.audio_url;
          } catch (audioError) {
            console.error('Failed to regenerate first question audio:', audioError);
          }
          
          ws.send(JSON.stringify({
            type: 'ai_response',
            text: firstAIEntry.content,
            audioUrl: firstQuestionAudio
          }));
        }
      }
    } catch (error) {
      console.error(`Error sending first question for session ${sessionId}:`, error);
    }
    
    console.log(`WebSocket connection established for session ${sessionId}`);
  }

  async handleMessage(sessionId, data) {
    const ws = this.connections.get(sessionId);
    if (!ws) return;
    
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'audio_data':
          await this.handleAudioData(sessionId, message.data);
          break;
        case 'end_speech':
          await this.processAudio(sessionId);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`
          }));
      }
    } catch (error) {
      console.error(`Message handling error for session ${sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  }

  // Function to merge WAV files using the wavefile library
  mergeWavFiles(buffers) {
    if (buffers.length === 0) {
      throw new Error("No buffers to concatenate");
    }

    // First buffer's header will be used
    let header = Buffer.from(buffers[0].slice(0, 44));
    let dataBuffers = [];

    buffers.forEach((buf, i) => {
      let pcm = buf.slice(44);
      dataBuffers.push(pcm);
    });

    const totalPCM = Buffer.concat(dataBuffers);

    // Fix header: chunk size & data size
    const finalBuffer = Buffer.concat([header, totalPCM]);

    finalBuffer.writeUInt32LE(finalBuffer.length - 8, 4);
    finalBuffer.writeUInt32LE(totalPCM.length, 40);

    return finalBuffer;
  }

  async handleAudioData(sessionId, audioData) {
    const ws = this.connections.get(sessionId);
    if (!ws) return;
    
    try {
      // Convert base64 to buffer and store in audio buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Get or create audio buffer for this session
      if (!this.audioBuffers.has(sessionId)) {
        this.audioBuffers.set(sessionId, []);
      }
      
      const sessionBuffer = this.audioBuffers.get(sessionId);
      sessionBuffer.push(audioBuffer);
      
      // Send acknowledgment
      ws.send(JSON.stringify({
        type: 'audio_received',
        size: audioBuffer.length
      }));
      
      // Do NOT send candidate_response here - only send when audio is actually transcribed
    } catch (error) {
      console.error(`Audio data handling error for session ${sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process audio data'
      }));
    }
  }

  async processAudio(sessionId) {
    const ws = this.connections.get(sessionId);
    if (!ws) return;
    
    try {
      // Get buffered audio data
      const audioBuffers = this.audioBuffers.get(sessionId) || [];
      
      if (audioBuffers.length === 0) {
        // No audio data to process
        ws.send(JSON.stringify({
          type: 'error',
          message: 'No audio data to process'
        }));
        return;
      }

      const fullAudioBuffer = this.mergeWavFiles(audioBuffers);
      
      // Clear the buffer for this session
      this.audioBuffers.set(sessionId, []);
      
      ws.send(JSON.stringify({
        type: 'processing_started'
      }));
      
      // Transcribe audio using STT service
      let transcription = '';
      
      try {
        console.log(`Sending audio to STT service for session ${sessionId}, buffer size: ${fullAudioBuffer.length}`);
        
        // Get session to determine language
        const session = await InterviewSession.findById(sessionId).populate('candidateId');
        let transcriptionLanguage = session?.candidateId?.personalInfo?.preferredLanguage || 'en';
        
        const sttResponse = await audioService.transcribeAudio(fullAudioBuffer, {
          language: transcriptionLanguage,
          modelSize: 'base'
        });
        
        transcription = sttResponse.transcription;
        
        console.log(`Transcription for session ${sessionId}: ${transcription}`);
        
        // Send candidate response to frontend
        ws.send(JSON.stringify({
          type: 'candidate_response',
          text: transcription
        }));
      } catch (sttError) {
        console.error('STT transcription error:', sttError);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to transcribe audio'
        }));
        return;
      }
      
      // Generate AI response based on transcription
      let aiResponse = 'I did not understand your response. Could you please repeat?';
      let nextQuestion = null;
      
      try {
        // Get session and candidate data for AI response generation
        const session = await InterviewSession.findById(sessionId).populate('candidateId');
        
        // Get candidate's preferred language
        const candidateLanguage = session?.candidateId?.personalInfo?.preferredLanguage || 'en';
        
        if (transcription && transcription.trim().length > 0) {
          // Get current question
          const currentQuestionIndex = session.currentQuestionIndex;
          const currentQuestion = session.questionsGenerated[currentQuestionIndex];

          // Use OpenRouter service for more sophisticated responses
          // Detect if candidate is asking a question using improved AI-based detection
          const isCandidateQuestion = await openRouterService.isAskingQuestion(transcription, currentQuestion);
          
          if (isCandidateQuestion) {
            // Standard response in appropriate language
            const redirectResponses = {
              en: "You can ask all questions to the human HR later",
              ru: "Все вопросы вы можете задать HR менеджеру позже"
            };
            
            aiResponse = redirectResponses[candidateLanguage] || redirectResponses.ru;
          } else {
            // Generate next question or follow-up
            const evaluation = await openRouterService.evaluateResponse(
              currentQuestion,
              transcription,
              session.candidateId
            );
            
            // Check if we should use follow-up or move to next question
            // ALWAYS ask a follow-up question first, then move to next question
            if (evaluation.followUp && evaluation.shouldContinue) {
              // Ask follow-up question with context
              // Customize follow-up response based on candidate's preferred language
              if (candidateLanguage === 'ru') {
                aiResponse = `Позвольте мне задать уточняющий вопрос. ${evaluation.followUp}`;
              } else {
                // Default to English
                aiResponse = `Let me ask a follow-up question. ${evaluation.followUp}`;
              }
              
              // Note that we're asking a follow-up, but we don't increment the question index
              // The next response will still be evaluated against the same main question
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

            // Save the updated session
            await session.save();
          }

        }
      } catch (aiError) {
        console.error('AI response generation error:', aiError);
        // Get candidate's preferred language for error message
        const candidateLanguage = session?.candidateId?.personalInfo?.preferredLanguage || 'ru';
        aiResponse = candidateLanguage === 'ru' 
          ? 'У меня возникли проблемы с обработкой вашего ответа. Можете попробовать еще раз?' 
          : 'I had trouble processing your response. Could you try again?';
      }
      
      // Generate audio response (optional)
      let audioUrl = null;
      try {
        // Get session to determine language
        const session = await InterviewSession.findById(sessionId).populate('candidateId');
        let responseLanguage = session?.candidateId?.personalInfo?.preferredLanguage || 'en';
        
        console.log(`Generating TTS for AI response in language: ${responseLanguage}`);
        const audioResponse = await audioService.generateSpeech(aiResponse, {
          emotion: 'professional',
          speed: 1.0,
          language: responseLanguage
        });
        audioUrl = audioResponse.audio_url;
        console.log(`Successfully generated TTS audio: ${audioUrl}`);
      } catch (audioError) {
        console.error('Audio generation error:', audioError);
        // Log additional details for debugging
        console.error('Audio generation error details:', {
          message: audioError.message,
          stack: audioError.stack,
          aiResponse: aiResponse?.substring(0, 100) // First 100 characters
        });
      }
      
      // Send AI response
      ws.send(JSON.stringify({
        type: 'ai_response',
        text: aiResponse,
        audioUrl: audioUrl
      }));
      
    } catch (error) {
      console.error(`Audio processing error for session ${sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process audio'
      }));
    }
  }

  handleDisconnection(sessionId) {
    console.log(`WebSocket disconnected for session ${sessionId}`);
    const audioBuffer = this.audioBuffers.get(sessionId);
    if (audioBuffer) {
      console.log(`Session ${sessionId} had ${audioBuffer.length} audio chunks buffered`);
    }
    this.connections.delete(sessionId);
    // Don't delete the audio buffer here, it might be needed for reconnection
    // this.audioBuffers.delete(sessionId);
  }
}

export default new SimpleWebSocketService();