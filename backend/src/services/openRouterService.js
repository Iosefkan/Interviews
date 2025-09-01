import axios from 'axios';
import { performance } from 'perf_hooks';

class OpenRouterService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-sonnet';
    this.baseURL = 'https://openrouter.ai/api/v1';
    
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not found in environment variables');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Conversation state tracking
    this.conversationContexts = new Map(); // sessionId -> context
    this.metrics = {
      responseLatency: [],
      conversationTurns: [],
      qualityScores: []
    };
  }

  async generateCompletion(messages, options = {}) {
    const startTime = performance.now();
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        ...options
      });

      const endTime = performance.now();
      const latency = endTime - startTime;
      
      // Track performance metrics
      this.metrics.responseLatency.push(latency);
      if (this.metrics.responseLatency.length > 100) {
        this.metrics.responseLatency.shift();
      }

      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage,
        processingTime: latency
      };
    } catch (error) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw new Error(`AI service error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async analyzeCv(cvText, jobDescription, jobTitle) {
    const systemPrompt = `You are an expert HR analyst tasked with evaluating candidate CVs for job positions. 
    Analyze the CV against the job requirements and provide a structured assessment.
    
    CRITICAL SCORING INSTRUCTIONS:
    1. Base the qualificationScore ENTIRELY on how well the candidate's experience matches the job requirements
    2. A score of 80-100 means the candidate exceeds most requirements
    3. A score of 60-79 means the candidate meets core requirements
    4. A score of 40-59 means the candidate partially meets requirements
    5. A score below 40 means the candidate does not meet key requirements
    6. DO NOT default to 85 - calculate based on actual match quality
    7. Be strict but fair in your evaluation
    
    Return your response in the following JSON format:
    {
      "qualified": boolean,
      "qualificationScore": number (0-100),
      "extractedData": {
        "skills": ["skill1", "skill2"],
        "experience": {
          "totalYears": number,
          "positions": [{"position": "title", "company": "name", "duration": "period", "technologies": ["tech1"], "responsibilities": ["resp1"]}],
          "education": [{"degree": "degree", "institution": "school", "year": "year", "grade": "grade"}]
        },
        "technologies": ["tech1", "tech2"],
        "certifications": ["cert1", "cert2"]
      },
      "aiNotes": "detailed analysis of candidate qualifications - explain why they were or weren't qualified based on specific evidence from their CV",
      "matchingCriteria": [{"criterion": "requirement", "met": boolean, "evidence": "explanation of how this requirement was or wasn't met based on CV evidence"}]
    }
    
    Do not wrap the answer in triple quotes, return just the JSON`;

    const userPrompt = `
    Job Title: ${jobTitle}
    
    Job Description:
    ${jobDescription}
    
    Candidate CV:
    ${cvText}
    
    Please analyze this CV against the job requirements and provide a comprehensive assessment.
    Remember to calculate a fair score based on actual matching quality, not a default value.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.3 });
    
    try {
      return JSON.parse(response.content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', response.content);
      throw new Error('Invalid AI response format');
    }
  }

  async extractPersonalInfo(cvText) {
    const systemPrompt = `You are a CV parsing expert. Extract personal information from the CV text provided.
    Focus on finding the candidate's full name, which is usually at the top of the CV.
    
    Return your response in the following JSON format:
    {
      "name": "Full Name",
      "confidence": number (0-100)
    }
    
    Rules:
    - Look for the candidate's name, usually in the first few lines
    - Ignore titles like Dr., Mr., Ms., Prof.
    - Return the most likely full name (first name + last name)
    - If multiple potential names found, choose the one that appears most prominently
    - Return null for name if no clear name is found
    
    Do not wrap the answer in triple quotes, return just the JSON`;

    const userPrompt = `Extract the personal information from this CV:

${cvText.slice(0, 1000)}`; // Only use first 1000 chars for efficiency

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.1, maxTokens: 200 });
    
    try {
      const result = JSON.parse(response.content);
      return result.name && result.confidence > 50 ? { name: result.name } : null;
    } catch (parseError) {
      console.error('Failed to parse AI personal info response:', response.content);
      return null;
    }
  }

  async generateInterviewQuestions(candidateData, interviewType = 'mixed') {
    const systemPrompt = `You are an expert interviewer. Generate relevant interview questions based on the candidate's CV and the interview type.
    
    Return your response as a JSON array of question objects:
    [
      {
        "question": "question text",
        "category": "technical|behavioral|clarification",
        "difficulty": "easy|medium|hard",
        "expectedSkills": ["skill1", "skill2"]
      }
    ]
      
    DO NOT WRAP THE ANSWER IN TRIPLE QUOTES, RETURN JUST THE JSON`;

    const userPrompt = `
    Interview Type: ${interviewType}
    Job Title: ${candidateData.jobInfo?.title}
    
    Candidate Skills from CV: ${candidateData.analysis?.extractedData?.skills?.join(', ')}
    Candidate Technologies: ${candidateData.analysis?.extractedData?.technologies?.join(', ')}
    
    Generate 8-12 appropriate interview questions that will help verify the candidate's skills and assess their fit for the role.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.5 });
    
    try {
      return JSON.parse(response.content);
    } catch (parseError) {
      console.error('Failed to parse questions response:', response.content);
      return []; // Return empty array if parsing fails
    }
  }

  // Helper method to detect questions using AI
  async isAskingQuestion(response, context = '') {
    // For very short responses, use the simple keyword approach as a fallback
    if (response.length < 10) {
      const questionIndicators = [
        'what', 'when', 'where', 'why', 'how', 'can you', 'could you',
        'would you', 'do you', 'is it', 'are you', 'will you',
        'как', 'когда', 'где', 'почему', 'что', 'можете ли вы', 'сможем ли мы'
      ];
      
      const lowerResponse = response.toLowerCase().trim();
      return questionIndicators.some(indicator => 
        lowerResponse.startsWith(indicator) || lowerResponse.includes(` ${indicator}`)
      );
    }
    
    // For longer responses, use AI to determine if it's a question
    const systemPrompt = `You are an expert at detecting whether a statement is a question or not.
    
    Analyze the provided text and determine if it is a question being asked by a candidate during an interview.
    
    Consider these factors:
    1. Direct questions (What, When, Where, Why, How, etc.)
    2. Indirect questions seeking information
    3. Requests for clarification
    4. Asking for help or guidance
    
    Return your response in JSON format:
    {
      "isQuestion": boolean,
      "confidence": number (0-100),
      "reasoning": "brief explanation of your decision"
    }
      
    Do not wrap the answer in triple quotes, return just the JSON`;

    const userPrompt = `
    Context: ${context}
    
    Candidate Statement: ${response}
    
    Is this a question?`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const aiResponse = await this.generateCompletion(messages, { temperature: 0.1, maxTokens: 300 });
      
      const result = JSON.parse(aiResponse.content);
      return result.isQuestion;
    } catch (error) {
      console.error('AI question detection failed:', error);
      // Fallback to keyword-based detection for longer responses
      const questionIndicators = [
        '?', 'what ', 'when ', 'where ', 'why ', 'how ', 'can you', 'could you',
        'would you', 'do you', 'is it', 'are you', 'will you', 'can i', 'could i',
        'would i', 'may i', 'might i', 'should i',
        'что ', 'как ', 'когда ', 'где ', 'почему ', 'можете ли вы', 'сможем ли мы'
      ];
      
      const lowerResponse = response.toLowerCase().trim();
      return questionIndicators.some(indicator => 
        lowerResponse.includes(indicator)
      );
    }
  }

  async evaluateResponse(question, candidateResponse, candidateData) {
    // Detect if candidate is asking a question using improved AI-based detection
    const isCandidateQuestion = await this.isAskingQuestion(candidateResponse, question);
    
    if (isCandidateQuestion) {
      // Get candidate's preferred language
      const language = candidateData.personalInfo?.preferredLanguage || 'ru';
      
      // Standard response in appropriate language
      const redirectResponses = {
        en: "You can ask all questions to the human HR later",
        ru: "Все вопросы вы можете задать HR менеджеру позже"
      };
      
      return {
        score: 5,
        feedback: "Candidate asked a question during interview",
        followUp: null,
        skillsVerified: [],
        communicationScore: 5,
        shouldContinue: true,
        isRedirect: true,
        response: redirectResponses[language] || redirectResponses.ru
      };
    }
    
    // Get candidate's preferred language
    const language = candidateData.personalInfo?.preferredLanguage || 'ru';
    
    const systemPrompt = `You are an expert interviewer evaluating a candidate's response. 
    Analyze the response for technical accuracy, communication skills, and relevance.
    
    Your goal is to assess the candidate's qualifications and decide whether to:
    1. Ask a follow-up question to dig deeper into an interesting point they made
    2. Move on to the next interview question
    3. Provide feedback on their response
    
    IMPORTANT: You MUST ask at least one follow-up question for each candidate response to ensure thorough evaluation.
    Even if the initial response seems complete, ask a follow-up to verify details or explore related aspects.
    
    CRITICAL: All responses must be in the candidate's preferred language: ${language === 'ru' ? 'Russian' : 'English'}.
    When generating follow-up questions and responses, use the appropriate language based on this requirement.
    
    When deciding whether to ask a follow-up question, consider:
    - Did they mention specific skills or experiences worth exploring?
    - Are there gaps or ambiguities in their response that need clarification?
    - Did they make claims that need verification with concrete examples?
    - Can you ask about related technologies or experiences?
    
    Return your response in JSON format:
    {
      "score": number (0-10),
      "feedback": "detailed feedback on the candidate's response",
      "followUp": "a follow-up question to dig deeper (REQUIRED - do not return null)",
      "skillsVerified": ["skill1", "skill2"],
      "communicationScore": number (0-10),
      "shouldContinue": boolean
    }
      
    Do not wrap the answer in triple quotes, return just the JSON`;

    const userPrompt = `
    Interview Question: ${question}
    Candidate Response: ${candidateResponse}
    
    Candidate Background:
    Skills: ${candidateData.analysis?.extractedData?.skills?.join(', ')}
    Experience: ${candidateData.analysis?.extractedData?.experience?.totalYears} years
    
    Preferred Language: ${language}
    
    Please evaluate this response comprehensively and generate a follow-up question. 
    Remember, you MUST ask at least one follow-up question for each response.
    IMPORTANT: All responses must be in ${language === 'ru' ? 'Russian' : 'English'}.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.3 });
    
    try {
      const result = JSON.parse(response.content);
      
      // Ensure that a follow-up question is always provided
      if (!result.followUp || result.followUp.trim() === '') {
        // Generate a generic follow-up if the AI didn't provide one
        result.followUp = language === 'ru' 
          ? "Можете ли вы привести конкретный пример из вашего опыта, который демонстрирует это?" 
          : "Could you provide a specific example from your experience that demonstrates this?";
      }
      
      return result;
    } catch (parseError) {
      console.error('Failed to parse evaluation response:', response.content);
      // Provide a default response with a generic follow-up question
      const isRussian = language === 'ru';
      return {
        score: 5,
        feedback: isRussian 
          ? 'Не удалось правильно оценить ответ' 
          : 'Unable to evaluate response properly',
        followUp: isRussian 
          ? "Можете ли вы привести конкретный пример из вашего опыта, который демонстрирует это?" 
          : "Could you provide a specific example from your experience that demonstrates this?",
        skillsVerified: [],
        communicationScore: 5,
        shouldContinue: true
      };
    }
  }

  async generateFinalEvaluation(interviewSession) {
    const systemPrompt = `You are an expert HR analyst providing a final interview evaluation.
    Analyze the complete interview transcript and provide comprehensive assessment.
    
    Return your response in JSON format:
    {
      "overallScore": number (0-100),
      "skillsAssessment": {
        "technical": [{"skill": "skill1", "score": number (0-100), "evidence": "evidence from transcript"}],
        "soft": [{"skill": "skill2", "score": number (0-100), "evidence": "evidence from transcript"}]
      },
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "recommendations": "HIGHLY RECOMMEND" | "RECOMMEND" | "CONSIDER" | "NOT RECOMMEND",
      "aiNotes": "detailed analysis",
      "communicationScore": number (0-10),
      "confidence": number (0-10)
    }
      
    Do not wrap the answer in triple quotes, return just the JSON`;

    const transcript = interviewSession.transcript
      .map(msg => `${msg.speaker}: ${msg.content}`)
      .join('\n');

    const userPrompt = `
    Interview Transcript:
    ${transcript}
    
    Please provide a comprehensive final evaluation of this candidate's interview performance.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.3 });
    
    try {
      return JSON.parse(response.content);
    } catch (parseError) {
      console.error('Failed to parse final evaluation:', response.content);
      throw new Error('Unable to generate final evaluation');
    }
  }

  // Enhanced Conversational Intelligence Methods
  
  initializeConversationContext(sessionId, candidateData) {
    this.conversationContexts.set(sessionId, {
      sessionId,
      candidateData,
      conversationHistory: [],
      questionSequence: [],
      currentQuestionIndex: 0,
      adaptiveQuestions: [],
      skillsToVerify: candidateData.analysis?.extractedData?.skills || [],
      verifiedSkills: [],
      conversationFlow: 'introduction',
      lastResponseQuality: null,
      followUpNeeded: false,
      totalTurns: 0
    });
  }

  getConversationContext(sessionId) {
    return this.conversationContexts.get(sessionId);
  }

  updateConversationContext(sessionId, updates) {
    const context = this.conversationContexts.get(sessionId);
    if (context) {
      Object.assign(context, updates);
      this.conversationContexts.set(sessionId, context);
    }
  }

  async generateContextualResponse(sessionId, candidateResponse, currentQuestion) {
    const context = this.getConversationContext(sessionId);
    if (!context) {
      throw new Error('Conversation context not found');
    }

    // Get candidate's preferred language
    const language = context.candidateData.personalInfo?.preferredLanguage || 'ru';

    const systemPrompt = `You are an expert AI interviewer conducting a real-time conversation with a candidate.
    Your goal is to assess their skills, experience, and cultural fit for the position.
    
    CONVERSATION GUIDELINES:
    1. Be conversational and natural, like a human interviewer
    2. ALWAYS ask at least one follow-up question to each candidate response to ensure thorough evaluation
    3. Adapt your questioning based on the candidate's responses
    4. Verify skills mentioned in their CV through practical examples
    5. Keep the conversation flowing and engaging
    6. Show empathy and professionalism
    7. CRITICAL: All responses must be in the candidate's preferred language: ${language === 'ru' ? 'Russian' : 'English'}
    
    RESPONSE FORMAT (JSON):
    {
      "response": "your natural conversational response in ${language === 'ru' ? 'Russian' : 'English'}",
      "evaluation": {
        "score": number (0-10),
        "feedback": "assessment of candidate's response",
        "skillsVerified": ["skill1", "skill2"],
        "communicationScore": number (0-10),
        "confidence": number (0-10)
      },
      "nextAction": {
        "type": "follow_up" | "next_question" | "clarification" | "wrap_up",
        "question": "next question or follow-up in ${language === 'ru' ? 'Russian' : 'English'} (REQUIRED - do not return null)",
        "reasoning": "why this direction was chosen"
      },
      "conversationFlow": "technical" | "behavioral" | "experience" | "wrap_up"
    }
      
    Do not wrap the answer in triple quotes, return just the JSON`;

    const conversationHistory = context.conversationHistory
      .slice(-6) // Keep last 6 exchanges for context
      .map(turn => `${turn.speaker}: ${turn.content}`)
      .join('\n');

    const userPrompt = `
    CANDIDATE PROFILE:
    Name: ${context.candidateData.personalInfo?.name}
    Position: ${context.candidateData.jobInfo?.title}
    Skills: ${context.skillsToVerify.join(', ')}
    Experience: ${context.candidateData.analysis?.extractedData?.experience?.totalYears} years
    Preferred Language: ${language}
    
    CONVERSATION CONTEXT:
    Current Question: ${currentQuestion}
    Total Conversation Turns: ${context.totalTurns}
    Skills Verified So Far: ${context.verifiedSkills.join(', ')}
    Current Flow: ${context.conversationFlow}
    
    RECENT CONVERSATION:
    ${conversationHistory}
    
    LATEST CANDIDATE RESPONSE:
    ${candidateResponse}
    
    Please provide a natural, conversational response that continues the interview effectively.
    IMPORTANT: All responses must be in ${language === 'ru' ? 'Russian' : 'English'}.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { 
      temperature: 0.7, // Higher temperature for more natural conversation
      maxTokens: 1500 
    });

    try {
      const result = JSON.parse(response.content);
      
      // Ensure that a next action question is always provided
      if (!result.nextAction || !result.nextAction.question || result.nextAction.question.trim() === '') {
        // Generate a generic follow-up if the AI didn't provide one
        result.nextAction = {
          type: "follow_up",
          question: language === 'ru' 
            ? "Можете ли вы привести конкретный пример из вашего опыта, который демонстрирует это?" 
            : "Could you provide a specific example from your experience that demonstrates this?",
          reasoning: language === 'ru' 
            ? "Обеспечение тщательной оценки с помощью дополнительного вопроса" 
            : "Ensuring thorough evaluation with follow-up question"
        };
      }
      
      // Update conversation context
      context.conversationHistory.push(
        { speaker: 'candidate', content: candidateResponse, timestamp: new Date() },
        { speaker: 'ai', content: result.response, timestamp: new Date() }
      );
      
      context.totalTurns += 1;
      context.lastResponseQuality = result.evaluation.score;
      context.conversationFlow = result.conversationFlow;
      
      // Update verified skills
      if (result.evaluation.skillsVerified.length > 0) {
        context.verifiedSkills = [...new Set([...context.verifiedSkills, ...result.evaluation.skillsVerified])];
      }
      
      this.updateConversationContext(sessionId, context);
      
      return result;
    } catch (parseError) {
      console.error('Failed to parse contextual response:', response.content);
      // Provide a default response with a generic follow-up question
      const isRussian = language === 'ru';
      return {
        response: isRussian 
          ? "Спасибо за ваш ответ. Можете ли вы привести конкретный пример из вашего опыта, который демонстрирует это?" 
          : "Thank you for your response. Could you provide a specific example from your experience that demonstrates this?",
        evaluation: {
          score: 5,
          feedback: isRussian 
            ? "Не удалось правильно оценить ответ" 
            : "Unable to evaluate response properly",
          skillsVerified: [],
          communicationScore: 5,
          confidence: 5
        },
        nextAction: {
          type: "follow_up",
          question: isRussian 
            ? "Можете ли вы привести конкретный пример из вашего опыта, который демонстрирует это?" 
            : "Could you provide a specific example from your experience that demonstrates this?",
          reasoning: isRussian 
            ? "Обеспечение тщательной оценки с помощью дополнительного вопроса" 
            : "Default follow-up due to evaluation error"
        },
        conversationFlow: "technical"
      };
    }
  }

  async generateFollowUpQuestion(sessionId, previousResponse, responseQuality) {
    const context = this.getConversationContext(sessionId);
    if (!context) {
      throw new Error('Conversation context not found');
    }

    const systemPrompt = `You are generating a follow-up question based on the candidate's previous response.
    Create a natural follow-up that digs deeper or clarifies their answer.
    
    Return JSON format:
    {
      "question": "your follow-up question",
      "type": "clarification" | "technical_deep_dive" | "behavioral_probe" | "example_request",
      "reasoning": "why this follow-up is valuable"
    }
      
    Do not wrap the answer in triple quotes, return just the JSON`;

    const userPrompt = `
    Previous Response: ${previousResponse}
    Response Quality Score: ${responseQuality}/10
    Skills Being Verified: ${context.skillsToVerify.join(', ')}
    
    Generate an appropriate follow-up question.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.6 });
    
    try {
      return JSON.parse(response.content);
    } catch (parseError) {
      console.error('Failed to parse follow-up question:', response.content);
      return {
        question: "Could you elaborate on that a bit more?",
        type: "clarification",
        reasoning: "General clarification request"
      };
    }
  }

  async adaptInterviewFlow(sessionId) {
    const context = this.getConversationContext(sessionId);
    if (!context) {
      throw new Error('Conversation context not found');
    }

    const averageResponseQuality = context.conversationHistory
      .filter(turn => turn.speaker === 'candidate')
      .reduce((acc, turn, idx) => acc + (context.lastResponseQuality || 5), 0) / 
      Math.max(context.conversationHistory.filter(turn => turn.speaker === 'candidate').length, 1);

    const systemPrompt = `You are adapting the interview flow based on the candidate's performance so far.
    Recommend the next phase of the interview.
    
    Return JSON format:
    {
      "recommendedFlow": "technical" | "behavioral" | "experience" | "wrap_up",
      "reasoning": "why this flow is recommended",
      "suggestedQuestions": ["question1", "question2"],
      "timeEstimate": "estimated minutes for this phase"
    }
      
    Do not wrap the answer in triple quotes, return just the JSON`;

    const userPrompt = `
    Current Interview Progress:
    - Total Turns: ${context.totalTurns}
    - Average Response Quality: ${averageResponseQuality.toFixed(1)}/10
    - Skills Verified: ${context.verifiedSkills.length}/${context.skillsToVerify.length}
    - Current Flow: ${context.conversationFlow}
    
    Recommend the best next phase for this interview.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.5 });
    
    try {
      return JSON.parse(response.content);
    } catch (parseError) {
      console.error('Failed to parse flow adaptation:', response.content);
      return {
        recommendedFlow: "technical",
        reasoning: "Continue with technical assessment",
        suggestedQuestions: ["Can you tell me about a technical challenge you've faced?"],
        timeEstimate: "10-15 minutes"
      };
    }
  }

  async calculateInterviewProgress(sessionId) {
    const context = this.getConversationContext(sessionId);
    if (!context) {
      return { progress: 0, estimated_remaining: 30 };
    }

    const skillsProgress = context.verifiedSkills.length / Math.max(context.skillsToVerify.length, 1);
    const conversationProgress = Math.min(context.totalTurns / 20, 1); // Assume 20 turns for complete interview
    
    const overallProgress = (skillsProgress + conversationProgress) / 2;
    const estimatedRemaining = Math.max(0, (1 - overallProgress) * 30); // 30 minutes base estimate

    return {
      progress: Math.round(overallProgress * 100),
      estimated_remaining: Math.round(estimatedRemaining),
      skills_verified: context.verifiedSkills.length,
      total_skills: context.skillsToVerify.length,
      conversation_turns: context.totalTurns
    };
  }

  // Performance monitoring
  getPerformanceMetrics() {
    const calculateAverage = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    return {
      ai: {
        averageLatency: calculateAverage(this.metrics.responseLatency),
        recentLatency: this.metrics.responseLatency.slice(-10),
        requestCount: this.metrics.responseLatency.length
      },
      conversations: {
        activeContexts: this.conversationContexts.size,
        totalTurns: Array.from(this.conversationContexts.values())
          .reduce((sum, ctx) => sum + ctx.totalTurns, 0)
      }
    };
  }

  // Cleanup conversation context
  cleanupConversationContext(sessionId) {
    this.conversationContexts.delete(sessionId);
  }  
}

export default new OpenRouterService();