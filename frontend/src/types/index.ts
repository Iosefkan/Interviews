// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Base API response that all backend responses extend
export interface BaseApiResponse {
  success: boolean;
  error?: string;
}

// Authentication types
export interface HRUser {
  id: string;
  email: string;
  name: string;
  role: 'hr';
  lastLogin?: Date;
  createdAt?: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse extends BaseApiResponse {
  token: string;
  user: HRUser;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

// Job types
export interface Job {
  _id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  status: 'active' | 'inactive' | 'closed';
  experience?: {
    min?: number;
    max?: number;
  };
  statistics: {
    totalCandidates: number;
    qualifiedCandidates: number;
    completedInterviews: number;
    averageScore: number;
  };
  createdBy: HRUser;
  candidates: string[];
  createdAt: Date;
  updatedAt: Date;
  formattedExperienceRange?: string;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  requiredSkills: string[];
  experience?: {
    min?: number;
    max?: number;
  };
}

export interface JobListResponse extends BaseApiResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface JobStatsResponse extends BaseApiResponse {
  statistics: {
    basic: Job['statistics'];
    candidateBreakdown: Record<string, number>;
    invitationStats: {
      totalCandidates: number;
      invitedCandidates: number;
      completedInterviews: number;
      invitationRate: string;
      completionRate: string;
    };
  };
  jobTitle: string;
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
  jobId: string | Job;
  personalInfo: PersonalInfo;
  jobInfo: JobInfo;
  analysis: CVAnalysis;
  status: 'pending' | 'qualified' | 'rejected' | 'interviewed' | 'hired' | 'invited';
  interviewInvitation?: {
    sent: boolean;
    sentAt?: Date;
    sessionKey?: string;
    expiresAt?: Date;
    interviewLink?: string;
    reminderSent?: boolean;
  };
  interviewSessions?: InterviewSession[];
  interviewStatus?: 'not-invited' | 'invited' | 'completed' | 'expired';
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
  candidateId: {
    _id: string;
    personalInfo: PersonalInfo;
    jobInfo: JobInfo;
  };
  sessionKey: string;
  isPublicAccess: boolean;
  expiresAt: Date;
  sessionType: 'technical' | 'behavioral' | 'mixed';
  status: 'pending' | 'active' | 'completed' | 'terminated' | 'error' | 'expired';
  transcript: InterviewMessage[];
  evaluation?: InterviewEvaluation;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  questionsGenerated: string[];
  currentQuestionIndex: number;
  interviewSettings: {
    maxQuestions: number;
    timeLimit: number;
    focusOnExperience?: boolean;
  };
  accessLog?: Array<{
    accessedAt: Date;
    ipAddress?: string;
    userAgent?: string;
    action: 'started' | 'resumed' | 'completed' | 'abandoned';
  }>;
  createdAt: Date;
  completedAt?: Date;
  questions?: Array<{question: string; answer?: string; score?: number;}>;
  overallScore?: number;
}

// Upload types
export interface CVUploadRequest {
  cv: File;
  jobId: string;
}

// Legacy upload interface (for manual job details)
export interface CVUploadRequestLegacy {
  cv: File;
  jobTitle: string;
  jobDescription: string;
}

export interface CVUploadResponse extends BaseApiResponse {
  candidateId: string;
  jobId: string;
  qualified: boolean;
  qualificationScore: number;
  extractedSkills: string[];
  experience: ExtractedData['experience'];
  aiNotes: string;
  nextStep: 'interview' | 'rejected';
  jobTitle: string;
}

// Interview invitation types
export interface InvitationRequest {
  candidateId: string;
}

export interface InvitationResponse extends BaseApiResponse {
  invitationSent: boolean;
  sessionKey: string;
  expiresAt: Date;
  interviewLink: string;
  emailMessageId?: string;
  candidateName: string;
  candidateEmail: string;
}

// Public interview types
export interface PublicInterviewStartRequest {
  sessionKey: string;
  interviewType?: 'technical' | 'behavioral' | 'mixed';
}

export interface PublicInterviewStartResponse extends BaseApiResponse {
  sessionId: string;
  candidateInfo: {
    name: string;
    jobTitle: string;
  };
  firstQuestion?: string;
  firstQuestionAudio?: string;
  totalQuestions: number;
  estimatedDuration: number;
  isResuming?: boolean;
  currentQuestion?: string;
  currentQuestionIndex?: number;
}

// Interview types

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

export interface ProcessAudioResponse extends BaseApiResponse {
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

// Enhanced CV Analysis Response (matches backend /cv/analysis/:candidateId)
export interface CVAnalysisResponse extends BaseApiResponse {
  candidateId: string;
  personalInfo: PersonalInfo;
  jobInfo: JobInfo & {
    jobId: string;
    status: Job['status'];
  };
  analysisResults: CVAnalysis;
  status: string;
  interviewStatus: 'not-invited' | 'invited' | 'completed' | 'expired';
  interviewSessions?: InterviewSession[];
  timestamp: Date;
}

// Candidate List Response (matches backend /jobs/:jobId/candidates)
export interface CandidateListResponse extends BaseApiResponse {
  candidates: Candidate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  jobInfo: {
    title: string;
    status: string;
  };
}

// Interview Results Response (matches backend /interview/results/:sessionId)
export interface InterviewResultsResponse extends BaseApiResponse {
  sessionId: string;
  candidate: Candidate;
  status: InterviewSession['status'];
  duration?: number;
  overallScore: number;
  skillsAssessment: {
    technical: SkillAssessment[];
    soft: SkillAssessment[];
    communication: number;
  };
  recommendations: string;
  transcript: InterviewMessage[];
  evaluation?: InterviewEvaluation;
  startTime: Date;
  endTime?: Date;
}

// Dashboard types with enhanced job-based statistics
export interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalCandidates: number;
  qualifiedCandidates: number;
  completedInterviews: number;
  averageScore: number;
  recentActivity: Array<{
    type: 'job_created' | 'cv_uploaded' | 'interview_completed' | 'candidate_invited';
    message: string;
    timestamp: Date;
    jobTitle?: string;
    candidateName?: string;
  }>;
}

// Authentication context type
export interface AuthContextType {
  user: HRUser | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  changePassword: (passwords: PasswordChangeRequest) => Promise<boolean>;
  updateProfile: (data: { name: string; email: string }) => Promise<boolean>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Route protection types
export interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Form validation types
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormErrors;
}

// Pagination helpers
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
}

// Report Response (for both CV and Interview reports)
export interface ReportResponse extends BaseApiResponse {
  reportUrl: string;
  fileName: string;
  generatedAt?: Date;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CandidateListResponse extends BaseApiResponse {
  candidates: Candidate[];
  pagination: PaginationInfo;
}

export interface InterviewListResponse extends BaseApiResponse {
  sessions: InterviewSession[];
  pagination: PaginationInfo;
}