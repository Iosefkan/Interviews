import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InterviewService } from '../services/hrService';
import type { 
  ProcessAudioRequest, 
  PublicInterviewStartRequest
} from '../types';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Send interview invitation (HR authenticated)
export const useInviteCandidate = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (candidateId: string) => InterviewService.inviteCandidate(candidateId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cv', 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(t('toast.interview.invitationSent', { name: data.candidateName }));
    },
    onError: (error: Error) => {
      toast.error(t('toast.interview.invitationFailed', { error: error.message }));
    },
  });
};

// Start public interview with session key
export const useStartPublicInterview = () => {
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (data: PublicInterviewStartRequest) => InterviewService.startPublicInterview(data),
    onSuccess: (data) => {
      if (data.isResuming) {
        toast.success(t('toast.interview.welcomeBack', { name: data.candidateInfo.name }));
      } else {
        toast.success(t('toast.interview.welcome', { name: data.candidateInfo.name, jobTitle: data.candidateInfo.jobTitle }));
      }
    },
    onError: (error: Error) => {
      toast.error(t('toast.interview.startFailed', { error: error.message }));
    },
  });
};

// Process audio during interview
export const useProcessAudio = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (data: ProcessAudioRequest) => InterviewService.processAudio(data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['interview', 'session', variables.sessionId] 
      });
      
      if (data.isComplete) {
        toast.success(t('toast.interview.completed'));
      }
    },
    onError: (error: Error) => {
      toast.error(t('toast.interview.processingFailed', { error: error.message }));
    },
  });
};

// Get interview results (HR authenticated)
export const useInterviewResults = (sessionId: string) => {
  return useQuery({
    queryKey: ['interview', 'results', sessionId],
    queryFn: () => InterviewService.getResults(sessionId),
    enabled: !!sessionId,
  });
};

// Get interview sessions list (HR authenticated)
export const useInterviewSessions = (params?: {
  page?: number;
  limit?: number;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['interview', 'sessions', params],
    queryFn: () => InterviewService.getSessions(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Terminate interview
export const useTerminateInterview = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (sessionId: string) => InterviewService.terminateInterview(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['interview', 'session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['interview', 'sessions'] });
      toast.success(t('toast.interview.terminated'));
    },
    onError: (error: Error) => {
      toast.error(t('toast.interview.terminateFailed', { error: error.message }));
    },
  });
};

// Generate interview report (HR authenticated)
export const useGenerateInterviewReport = () => {
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (sessionId: string) => InterviewService.generateReport(sessionId),
    onSuccess: (data) => {
      toast.success(t('toast.interview.reportGenerated'));
      window.open(data.reportUrl, '_blank');
    },
    onError: (error: Error) => {
      toast.error(t('toast.interview.reportGenerationFailed', { error: error.message }));
    },
  });
};

// Custom hook for interview analytics
export const useInterviewAnalytics = () => {
  const {
    data: sessionsData,
    isLoading,
    error
  } = useInterviewSessions({
    page: 1,
    limit: 100, // Get all sessions for analytics
  });

  const sessions = sessionsData?.sessions || [];
  
  // Filter by job if specified (would need to be implemented in backend)
  const filteredSessions = sessions; // jobId ? sessions.filter(s => s.jobId === jobId) : sessions;
  
  const analytics = {
    total: filteredSessions.length,
    completed: filteredSessions.filter(s => s.status === 'completed').length,
    active: filteredSessions.filter(s => s.status === 'active').length,
    terminated: filteredSessions.filter(s => s.status === 'terminated').length,
    averageDuration: getAverageDuration(filteredSessions),
    averageScore: getAverageScore(filteredSessions),
    completionRate: filteredSessions.length > 0 
      ? (filteredSessions.filter(s => s.status === 'completed').length / filteredSessions.length * 100)
      : 0
  };

  return {
    analytics,
    sessions: filteredSessions,
    isLoading,
    error
  };
};

// Helper functions
function getAverageDuration(sessions: any[]) {
  const completedSessions = sessions.filter(s => s.status === 'completed' && s.duration);
  if (completedSessions.length === 0) return 0;
  
  const totalDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0);
  return Math.round(totalDuration / completedSessions.length / 60); // Convert to minutes
}

function getAverageScore(sessions: any[]) {
  const sessionsWithScores = sessions.filter(s => s.evaluation?.overallScore);
  if (sessionsWithScores.length === 0) return 0;
  
  const totalScore = sessionsWithScores.reduce((sum, s) => sum + s.evaluation.overallScore, 0);
  return Math.round(totalScore / sessionsWithScores.length);
}

// Export a combined hook for convenience
export const useInterviewQueries = () => ({
  inviteCandidate: useInviteCandidate(),
  startPublicInterview: useStartPublicInterview(),
  processAudio: useProcessAudio(),
  useInterviewSession: useInterviewResults, // Alias for compatibility
  useInterviewSessions,
  terminateInterview: useTerminateInterview(),
  generateInterviewReport: useGenerateInterviewReport(),
  analytics: useInterviewAnalytics
});