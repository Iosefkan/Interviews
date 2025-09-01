import axios from 'axios';

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
  }

  async generateCompletion(messages, options = {}) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        ...options
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw new Error(`AI service error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async analyzeCv(cvText, jobDescription, jobTitle) {
    const systemPrompt = `You are an expert HR analyst tasked with evaluating candidate CVs for job positions. 
    Analyze the CV against the job requirements and provide a structured assessment.
    
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
      "aiNotes": "detailed analysis of candidate qualifications",
      "matchingCriteria": [{"criterion": "requirement", "met": boolean, "evidence": "explanation"}]
    }`;

    const userPrompt = `
    Job Title: ${jobTitle}
    
    Job Description:
    ${jobDescription}
    
    Candidate CV:
    ${cvText}
    
    Please analyze this CV against the job requirements and provide a comprehensive assessment.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.3 });
    
    try {
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      throw new Error('Invalid AI response format');
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
    ]`;

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
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse questions response:', response);
      return []; // Return empty array if parsing fails
    }
  }

  async evaluateResponse(question, candidateResponse, candidateData) {
    const systemPrompt = `You are an expert interviewer evaluating a candidate's response. 
    Analyze the response for technical accuracy, communication skills, and relevance.
    
    Return your response in JSON format:
    {
      "score": number (0-10),
      "feedback": "detailed feedback",
      "followUp": "follow-up question if needed",
      "skillsVerified": ["skill1", "skill2"],
      "communicationScore": number (0-10),
      "shouldContinue": boolean
    }`;

    const userPrompt = `
    Question: ${question}
    Candidate Response: ${candidateResponse}
    
    Candidate Background:
    Skills: ${candidateData.analysis?.extractedData?.skills?.join(', ')}
    Experience: ${candidateData.analysis?.extractedData?.experience?.totalYears} years
    
    Please evaluate this response comprehensively.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages, { temperature: 0.3 });
    
    try {
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse evaluation response:', response);
      return {
        score: 5,
        feedback: 'Unable to evaluate response properly',
        followUp: null,
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
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "recommendations": "hiring recommendation",
      "aiNotes": "detailed analysis",
      "communicationScore": number (0-10),
      "confidence": number (0-10)
    }`;

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
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse final evaluation:', response);
      throw new Error('Unable to generate final evaluation');
    }
  }
}

export default new OpenRouterService();