import api from './api';
import {
  type LoginCredentials,
  type LoginResponse,
  type PasswordChangeRequest,
  type HRUser,
  type Job,
  type CreateJobRequest,
  type JobListResponse,
  type JobStatsResponse,
  type CVUploadRequest,
  type CVUploadResponse,
  type InvitationResponse,
  type PublicInterviewStartRequest,
  type PublicInterviewStartResponse,
  type ProcessAudioRequest,
  type ProcessAudioResponse,
  type CandidateListResponse,
  type CVAnalysisResponse,
  type InterviewResultsResponse,
  type BaseApiResponse,
  type DashboardStats,
} from '../types';

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return api.post('/auth/login', credentials);
  }

  static async logout(): Promise<BaseApiResponse> {
    return api.post('/auth/logout');
  }

  static async changePassword(passwords: PasswordChangeRequest): Promise<BaseApiResponse> {
    return api.put('/auth/change-password', passwords);
  }

  static async getProfile(): Promise<{ success: boolean; user: HRUser }> {
    return api.get('/auth/me');
  }

  static async updateProfile(data: { name: string; email: string }): Promise<BaseApiResponse & { user: HRUser }> {
    return api.put('/auth/profile', data);
  }

  static async checkUsers(): Promise<{ success: boolean; hasUsers: boolean; userCount: number }> {
    return api.get('/auth/check');
  }

  static async initializeDefault(): Promise<BaseApiResponse> {
    return api.post('/auth/init');
  }
}

export class JobService {
  static async createJob(data: CreateJobRequest): Promise<{ success: boolean; job: Job }> {
    return api.post('/jobs', data);
  }

  static async getJobs(params?: {
    page?: number;
    limit?: number;
    status?: string;
    department?: string;
    employmentType?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<JobListResponse> {
    return api.get('/jobs', { params });
  }

  static async getJob(jobId: string): Promise<{ success: boolean; job: Job }> {
    return api.get(`/jobs/${jobId}`);
  }

  static async updateJob(jobId: string, data: Partial<CreateJobRequest>): Promise<{ success: boolean; job: Job }> {
    return api.put(`/jobs/${jobId}`, data);
  }

  static async updateJobStatus(jobId: string, status: 'active' | 'inactive' | 'closed'): Promise<BaseApiResponse> {
    return api.patch(`/jobs/${jobId}/status`, { status });
  }

  static async deleteJob(jobId: string): Promise<BaseApiResponse> {
    return api.delete(`/jobs/${jobId}`);
  }

  static async getJobCandidates(jobId: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<CandidateListResponse> {
    return api.get(`/jobs/${jobId}/candidates`, { params });
  }

  static async getJobStatistics(jobId: string): Promise<JobStatsResponse> {
    return api.get(`/jobs/${jobId}/statistics`);
  }
}

export class CVService {
  static async uploadCV(data: CVUploadRequest): Promise<CVUploadResponse> {
    const formData = new FormData();
    formData.append('cv', data.cv);

    return api.post(`/cv/upload/${data.jobId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  static async getAnalysis(candidateId: string): Promise<CVAnalysisResponse> {
    return api.get(`/cv/analysis/${candidateId}`);
  }

  static async getCandidates(params?: {
    page?: number;
    limit?: number;
    status?: string;
    jobId?: string;
  }): Promise<CandidateListResponse> {
    return api.get('/cv/candidates', { params });
  }

  static async generateCVReport(candidateId: string): Promise<{ success: boolean; reportUrl: string; fileName: string; generatedAt: Date }> {
    return api.get(`/cv/report/${candidateId}`);
  }

  static async deleteCandidate(candidateId: string): Promise<BaseApiResponse & {
    message: string;
    deletedCandidateId: string;
    deletedAssociations: {
      interviewSessions: boolean;
      cvFile: boolean;
      jobAssociation: boolean;
    };
  }> {
    return api.delete(`/cv/candidate/${candidateId}`);
  }

  static async downloadCV(candidateId: string): Promise<void> {
    const response = await fetch(`${api.defaults.baseURL}/cv/download/${candidateId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('hr_token')}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to download CV' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'cv.pdf';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export class InterviewService {
  // HR authenticated methods
  static async inviteCandidate(candidateId: string): Promise<InvitationResponse> {
    return api.post(`/interview/invite/${candidateId}`);
  }

  static async getResults(sessionId: string): Promise<InterviewResultsResponse> {
    return api.get(`/interview/results/${sessionId}`);
  }

  static async generateReport(sessionId: string): Promise<{ success: boolean; reportUrl: string; fileName: string; generatedAt: Date }> {
    return api.get(`/interview/report/${sessionId}`);
  }

  static async terminateInterview(sessionId: string): Promise<BaseApiResponse> {
    return api.post(`/interview/terminate/${sessionId}`);
  }

  static async getSessions(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ success: boolean; sessions: any[]; pagination: any }> {
    return api.get('/interview/sessions', { params });
  }

  // Public methods (no authentication required)
  static async startPublicInterview(data: PublicInterviewStartRequest): Promise<PublicInterviewStartResponse> {
    // Use a different API instance without auth headers for public access
    return fetch(`${api.defaults.baseURL}/interview/start-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).then(res => res.json());
  }

  static async processAudio(data: ProcessAudioRequest): Promise<ProcessAudioResponse> {
    const formData = new FormData();
    formData.append('audio', data.audio);
    formData.append('sessionId', data.sessionId);
    if (data.questionId) {
      formData.append('questionId', data.questionId);
    }

    // This endpoint works for both authenticated and public access
    return api.post('/interview/audio/process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

export class DashboardService {
  static async getStats(): Promise<{ success: boolean; stats: DashboardStats }> {
    // This would be implemented as an aggregated endpoint on the backend
    // For now, we'll fetch data from multiple endpoints
    const [jobsResponse, candidatesResponse] = await Promise.all([
      JobService.getJobs({ page: 1, limit: 100 }),
      CVService.getCandidates({ page: 1, limit: 100 })
    ]);

    const jobs = jobsResponse.jobs;
    const candidates = candidatesResponse.candidates;

    const stats: DashboardStats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'active').length,
      totalCandidates: candidates.length,
      qualifiedCandidates: candidates.filter(c => c.status === 'qualified' || c.status === 'invited' || c.status === 'interviewed').length,
      completedInterviews: candidates.filter(c => c.interviewSessions && c.interviewSessions.length > 0).length,
      averageScore: 0, // Would be calculated from interview results
      recentActivity: [] // Would be fetched from a dedicated endpoint
    };

    return { success: true, stats };
  }
}

export class HealthService {
  static async checkHealth(): Promise<any> {
    return api.get('/health');
  }

  static async getDetailedHealth(): Promise<any> {
    return api.get('/health/detailed');
  }
}

// Export all services as default
export default {
  AuthService,
  JobService,
  CVService,
  InterviewService,
  DashboardService,
  HealthService,
};