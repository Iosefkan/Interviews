import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { JobService } from '../services/hrService';
import type { CreateJobRequest } from '../types';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Get all jobs with filtering and pagination
export const useJobs = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  department?: string;
  employmentType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => JobService.getJobs(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Get specific job details
export const useJob = (jobId: string) => {
  return useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => JobService.getJob(jobId),
    enabled: !!jobId,
    select: (data) => data.job,
  });
};

// Create new job
export const useCreateJob = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (data: CreateJobRequest) => JobService.createJob(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.setQueryData(['jobs', data.job._id], { job: data.job });
      toast.success(t('toast.jobs.created', { title: data.job.title }));
    },
    onError: (error: Error) => {
      toast.error(t('toast.jobs.createFailed', { error: error.message }));
    },
  });
};

// Update job
export const useUpdateJob = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: Partial<CreateJobRequest> }) => 
      JobService.updateJob(jobId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.setQueryData(['jobs', data.job._id], { job: data.job });
      toast.success(t('toast.jobs.updated', { title: data.job.title }));
    },
    onError: (error: Error) => {
      toast.error(t('toast.jobs.updateFailed', { error: error.message }));
    },
  });
};

// Update job status
export const useUpdateJobStatus = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: 'active' | 'inactive' | 'closed' }) => 
      JobService.updateJobStatus(jobId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', variables.jobId] });
      toast.success(t('toast.jobs.statusUpdated', { status: variables.status }));
    },
    onError: (error: Error) => {
      toast.error(t('toast.jobs.statusUpdateFailed', { error: error.message }));
    },
  });
};

// Delete job
export const useDeleteJob = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  return useMutation({
    mutationFn: (jobId: string) => JobService.deleteJob(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.removeQueries({ queryKey: ['jobs', jobId] });
      toast.success(t('toast.jobs.deleted'));
    },
    onError: (error: Error) => {
      toast.error(t('toast.jobs.deleteFailed', { error: error.message }));
    },
  });
};

// Get job candidates
export const useJobCandidates = (jobId: string, params?: {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  return useQuery({
    queryKey: ['jobs', jobId, 'candidates', params],
    queryFn: () => JobService.getJobCandidates(jobId, params),
    enabled: !!jobId,
  });
};

// Get job statistics
export const useJobStatistics = (jobId: string) => {
  return useQuery({
    queryKey: ['jobs', jobId, 'statistics'],
    queryFn: () => JobService.getJobStatistics(jobId),
    enabled: !!jobId,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
};

// Custom hook for job management dashboard
export const useJobDashboard = () => {
  const {
    data: jobsData,
    isLoading: isLoadingJobs,
    error: jobsError
  } = useJobs({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });

  const jobs = jobsData?.jobs || [];
  const activeJobs = jobs.filter(job => job.status === 'active');
  const totalCandidates = jobs.reduce((sum, job) => sum + job.statistics.totalCandidates, 0);
  const qualifiedCandidates = jobs.reduce((sum, job) => sum + job.statistics.qualifiedCandidates, 0);
  const completedInterviews = jobs.reduce((sum, job) => sum + job.statistics.completedInterviews, 0);
  
  return {
    jobs,
    activeJobs,
    statistics: {
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      totalCandidates,
      qualifiedCandidates,
      completedInterviews,
      averageScore: jobs.length > 0 
        ? jobs.reduce((sum, job) => sum + job.statistics.averageScore, 0) / jobs.length 
        : 0
    },
    isLoading: isLoadingJobs,
    error: jobsError
  };
};