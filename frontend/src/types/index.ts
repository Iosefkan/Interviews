// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Candidate types
export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
}

export interface JobInfo {
  title: string;
  description: string;
}

export interface WorkExperience {
  position: string;
  company: string;
  duration: string;
  technologies: string[];
  responsibilities: string[];
}

export interface Education {
  degree: string;
  institution: string;
  year?: string;
  grade?: string;
}

export interface ExtractedData {
  skills: string[];
  experience: {
    totalYears: number;
    positions: WorkExperience[];
    education: Education[];
  };
  technologies: string[];
  certifications: string[];
}

export interface MatchingCriterion {
  criterion: string;
  met: boolean;
  evidence?: string;
}

export interface CVAnalysis {
  qualified: boolean;
  qualificationScore: number;
  extractedData: ExtractedData;
  aiNotes: string;
  matchingCriteria: MatchingCriterion[];
  processedAt: Date;
}

export interface Candidate {
  _id: string;
  personalInfo: PersonalInfo;
  jobInfo: JobInfo;
  analysis: CVAnalysis;
  status: 'pending' | 'qualified' | 'rejected' | 'interviewed' | 'hired';
  createdAt: Date;
  updatedAt: Date;
}

// Interview types
export interface InterviewMessage {
  speaker: 'ai' | 'candidate';
  content: string;
  timestamp: Date;
  questionCategory?: 'technical' | 'behavioral' | 'clarification' | 'general';
  confidence?: number;
}

export interface SkillAssessment {
  skill: string;
  claimed: boolean;
  verified: boolean;
  score: number;
  evidence?: string;
}

export interface InterviewEvaluation {
  overallScore: number;
  skillsVerified: SkillAssessment[];
  communicationScore: number;
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string;
  aiNotes: string;
}

export interface InterviewSession {
  _id: string;
  candidateId: string;
  sessionType: 'technical' | 'behavioral' | 'mixed';
  status: 'active' | 'completed' | 'terminated' | 'error';
  transcript: InterviewMessage[];
  evaluation?: InterviewEvaluation;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  questionsGenerated: string[];
  currentQuestionIndex: number;
}

// Upload types
export interface CVUploadRequest {
  cv: File;
  jobDescription: string;
  jobTitle: string;
}

export interface CVUploadResponse {
  candidateId: string;
  qualified: boolean;
  qualificationScore: number;
  extractedSkills: string[];
  experience: ExtractedData['experience'];
  aiNotes: string;
  nextStep: 'interview' | 'rejected';
}

// Interview types
export interface StartInterviewRequest {
  candidateId: string;
  interviewType?: 'technical' | 'behavioral' | 'mixed';
}

export interface StartInterviewResponse {
  sessionId: string;
  interviewQuestions: InterviewQuestion[];
  estimatedDuration: number;
  firstQuestionAudio?: string;
  currentQuestion?: string;
}

export interface InterviewQuestion {
  question: string;
  category: 'technical' | 'behavioral' | 'clarification';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedSkills: string[];
}

export interface ProcessAudioRequest {
  audio: Blob;
  sessionId: string;
  questionId?: string;
}

export interface ProcessAudioResponse {
  transcription: string;
  confidence: number;
  aiResponse: string;
  audioResponseUrl?: string;
  nextQuestion?: string;
  isComplete: boolean;
  evaluation: {
    score: number;
    feedback: string;
    skillsVerified: string[];
  };
}

// Dashboard types
export interface DashboardStats {
  totalCandidates: number;
  qualifiedCandidates: number;
  completedInterviews: number;
  averageScore: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CandidateListResponse {
  candidates: Candidate[];
  pagination: PaginationInfo;
}

export interface InterviewListResponse {
  sessions: InterviewSession[];
  pagination: PaginationInfo;
}