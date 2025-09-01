import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CVService } from '../services/hrService';
import type { CVUploadRequest } from '../types';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Upload CV for a specific job
export const useUploadCV = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (data: CVUploadRequest) => CVService.uploadCV(data),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['jobs', data.jobId, 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', data.jobId, 'statistics'] });
      queryClient.invalidateQueries({ queryKey: ['cv', 'candidates'] });
      
      if (data.qualified) {
        toast.success(t('toast.cv.uploadSuccessQualified', { jobTitle: data.jobTitle }));
      } else {
        toast.success(t('toast.cv.uploadSuccessNotQualified', { jobTitle: data.jobTitle }));
      }
    },
    onError: (error: Error) => {
      toast.error(t('toast.cv.uploadFailed', { error: error.message }));
    },
  });
};

// Get CV analysis for a candidate
export const useCVAnalysis = (candidateId: string) => {
  return useQuery({
    queryKey: ['cv', 'analysis', candidateId],
    queryFn: () => CVService.getAnalysis(candidateId),
    enabled: !!candidateId,
  });
};

// Get all candidates with filtering
export const useCandidates = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  jobId?: string;
}) => {
  return useQuery({
    queryKey: ['cv', 'candidates', params],
    queryFn: () => CVService.getCandidates(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Generate CV analysis report
export const useGenerateCVReport = () => {
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (candidateId: string) => CVService.generateCVReport(candidateId),
    onSuccess: (data) => {
      toast.success(t('toast.cv.reportGenerated'));
      // Open report in new tab
      window.open(data.reportUrl, '_blank');
    },
    onError: (error: Error) => {
      toast.error(t('toast.cv.reportGenerationFailed', { error: error.message }));
    },
  });
};

// Delete candidate (hard delete)
export const useDeleteCandidate = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (candidateId: string) => CVService.deleteCandidate(candidateId),
    onSuccess: (_, candidateId) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['cv', 'candidates'] });
      queryClient.invalidateQueries({ queryKey: ['cv', 'analysis', candidateId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] }); // Update job statistics
      
      // Find any job-specific candidate queries and invalidate them
      queryClient.invalidateQueries({ queryKey: ['jobs'], type: 'all' });
      
      toast.success(t('toast.cv.candidateDeleted'));
    },
    onError: (error: Error) => {
      toast.error(t('toast.cv.deleteFailed', { error: error.message }));
    },
  });
};

// Download CV file
export const useDownloadCV = () => {
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (candidateId: string) => CVService.downloadCV(candidateId),
    onSuccess: () => {
      toast.success(t('toast.cv.downloadStarted'));
    },
    onError: (error: Error) => {
      toast.error(t('toast.cv.downloadFailed', { error: error.message }));
    },
  });
};

// Custom hook for CV dashboard analytics
export const useCVAnalytics = (jobId?: string) => {
  const {
    data: candidatesData,
    isLoading,
    error
  } = useCandidates({
    jobId,
    page: 1,
    limit: 100, // Get all candidates for analytics
  });

  const candidates = candidatesData?.candidates || [];
  
  const analytics = {
    total: candidates.length,
    qualified: candidates.filter(c => c.analysis?.qualified).length,
    rejected: candidates.filter(c => c.status === 'rejected').length,
    interviewed: candidates.filter(c => c.status === 'interviewed').length,
    invited: candidates.filter(c => c.status === 'invited').length,
    averageScore: candidates.length > 0 
      ? candidates.reduce((sum, c) => sum + (c.analysis?.qualificationScore || 0), 0) / candidates.length 
      : 0,
    topSkills: extractTopSkills(candidates),
    statusBreakdown: getStatusBreakdown(candidates)
  };

  return {
    analytics,
    candidates,
    isLoading,
    error
  };
};

// Helper function to extract top skills from candidates
function extractTopSkills(candidates: any[]) {
  const skillCounts: Record<string, number> = {};
  
  candidates.forEach(candidate => {
    if (candidate.analysis?.extractedData?.skills) {
      candidate.analysis.extractedData.skills.forEach((skill: string) => {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      });
    }
  });
  
  return Object.entries(skillCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, count }));
}

// Helper function to get status breakdown
function getStatusBreakdown(candidates: any[]) {
  const breakdown: Record<string, number> = {
    pending: 0,
    qualified: 0,
    rejected: 0,
    invited: 0,
    interviewed: 0,
    hired: 0
  };
  
  candidates.forEach(candidate => {
    if (candidate.status in breakdown) {
      breakdown[candidate.status]++;
    }
  });
  
  return breakdown;
}

// Export a combined hook for convenience
export const useCVQueries = () => ({
  uploadCV: useUploadCV(),
  cvAnalysis: useCVAnalysis,
  useCandidates,
  generateCVReport: useGenerateCVReport(),
  deleteCandidate: useDeleteCandidate(),
  downloadCV: useDownloadCV(),
  analytics: useCVAnalytics
});