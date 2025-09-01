import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InterviewService } from '../services/hrService'
import { queryKeys } from '../lib/queryClient'
import { 
  type StartInterviewRequest, 
  type StartInterviewResponse, 
  type ProcessAudioRequest, 
  type ProcessAudioResponse, 
  type InterviewListResponse,
  type InterviewResultsResponse,
  type ReportResponse
} from '../types'

export const useInterviewQueries = () => {
  const queryClient = useQueryClient()

  // Start interview mutation
  const startInterview = useMutation<StartInterviewResponse, Error, StartInterviewRequest>({
    mutationFn: InterviewService.startInterview,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.interview(data.sessionId), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews() })
    },
    onError: (error) => {
      console.error('Start interview failed:', error)
    }
  })

  // Process audio mutation
  const processAudio = useMutation<ProcessAudioResponse, Error, ProcessAudioRequest>({
    mutationFn: InterviewService.processAudio,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.interview(variables.sessionId) 
      })
    },
    onError: (error) => {
      console.error('Audio processing failed:', error)
    }
  })

  // Get interview session
  const useInterviewSession = (sessionId?: string) => {
    return useQuery<InterviewResultsResponse, Error>({
      queryKey: queryKeys.interview(sessionId!),
      queryFn: () => InterviewService.getResults(sessionId!),
      enabled: !!sessionId,
      refetchInterval: (query) => {
        // Poll every 5 seconds if interview is active
        return query?.state?.data?.status === 'active' ? 5000 : false
      }
    })
  }

  // Get interview sessions list
  const useInterviewSessions = (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    return useQuery<InterviewListResponse, Error>({
      queryKey: queryKeys.interviews(params),
      queryFn: () => InterviewService.getSessions(params)
    })
  }

  // Terminate interview mutation
  const terminateInterview = useMutation<void, Error, string>({
    mutationFn: InterviewService.terminateInterview,
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.interview(sessionId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.interviews() })
    },
    onError: (error) => {
      console.error('Interview termination failed:', error)
    }
  })

  // Generate interview report mutation
  const generateInterviewReport = useMutation<ReportResponse, Error, string>({
    mutationFn: InterviewService.generateReport,
    onError: (error) => {
      console.error('Interview report generation failed:', error)
    }
  })

  return {
    startInterview,
    processAudio,
    useInterviewSession,
    useInterviewSessions,
    terminateInterview,
    generateInterviewReport
  }
}