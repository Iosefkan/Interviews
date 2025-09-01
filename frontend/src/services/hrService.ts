import api from './api';
import {
  CVUploadRequest,
  CVUploadResponse,
  StartInterviewRequest,
  StartInterviewResponse,
  ProcessAudioRequest,
  ProcessAudioResponse,
  Candidate,
  InterviewSession,
  CandidateListResponse,
  InterviewListResponse,
} from '../types';

export class CVService {
  static async uploadCV(data: CVUploadRequest): Promise<CVUploadResponse> {
    const formData = new FormData();
    formData.append('cv', data.cv);
    formData.append('jobDescription', data.jobDescription);
    formData.append('jobTitle', data.jobTitle);

    return api.post('/cv/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  static async getAnalysis(candidateId: string): Promise<{ candidate: Candidate }> {
    return api.get(`/cv/analysis/${candidateId}`);
  }

  static async getCandidates(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<CandidateListResponse> {
    return api.get('/cv/candidates', { params });
  }

  static async updateCandidateStatus(candidateId: string, status: string): Promise<void> {
    return api.patch(`/cv/candidate/${candidateId}/status`, { status });
  }

  static async generateCVReport(candidateId: string): Promise<{ reportUrl: string; fileName: string }> {
    return api.get(`/cv/report/${candidateId}`);
  }
}

export class InterviewService {
  static async startInterview(data: StartInterviewRequest): Promise<StartInterviewResponse> {
    return api.post('/interview/start', data);
  }

  static async processAudio(data: ProcessAudioRequest): Promise<ProcessAudioResponse> {
    const formData = new FormData();
    formData.append('audio', data.audio);
    formData.append('sessionId', data.sessionId);
    if (data.questionId) {
      formData.append('questionId', data.questionId);
    }

    return api.post('/interview/audio/process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  static async getResults(sessionId: string): Promise<InterviewSession> {
    return api.get(`/interview/results/${sessionId}`);
  }

  static async generateReport(sessionId: string): Promise<{ reportUrl: string; fileName: string }> {
    return api.get(`/interview/report/${sessionId}`);
  }

  static async terminateInterview(sessionId: string): Promise<void> {
    return api.post(`/interview/terminate/${sessionId}`);
  }

  static async getSessions(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<InterviewListResponse> {
    return api.get('/interview/sessions', { params });
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