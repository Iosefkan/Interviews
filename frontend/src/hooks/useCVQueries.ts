import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CVService } from '../services/hrService'
import { queryKeys } from '../lib/queryClient'
import { 
  type CVUploadRequest, 
  type CVUploadResponse, 
  type Candidate, 
  type CandidateListResponse 
} from '../types'

export const useCVQueries = () => {
  const queryClient = useQueryClient()

  // Upload CV mutation
  const uploadCV = useMutation<CVUploadResponse, Error, CVUploadRequest>({
    mutationFn: CVService.uploadCV,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates() })
    },
    onError: (error) => {
      console.error('CV upload failed:', error)
    }
  })

  // Get candidates list
  const useCandidates = (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    return useQuery<CandidateListResponse, Error>({
      queryKey: queryKeys.candidates(params),
      queryFn: () => CVService.getCandidates(params)
    })
  }

  // Get CV analysis
  const useCVAnalysis = (candidateId?: string) => {
    return useQuery<{ candidate: Candidate }, Error>({
      queryKey: queryKeys.cvAnalysis(candidateId!),
      queryFn: () => CVService.getAnalysis(candidateId!),
      enabled: !!candidateId
    })
  }

  // Update candidate status mutation
  const updateCandidateStatus = useMutation<
    void, 
    Error, 
    { candidateId: string; status: string },
    { previousCandidates: CandidateListResponse | undefined }
  >({
    mutationFn: ({ candidateId, status }) => CVService.updateCandidateStatus(candidateId, status),
    onMutate: async ({ candidateId, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.candidates() })
      
      // Snapshot previous value
      const previousCandidates = queryClient.getQueryData(queryKeys.candidates()) as CandidateListResponse | undefined
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.candidates(), (old: any) => {
        if (!old) return old
        return {
          ...old,
          items: old.items?.map((candidate: Candidate) =>
            candidate._id === candidateId 
              ? { ...candidate, status }
              : candidate
          ) || []
        }
      })
      
      return { previousCandidates }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousCandidates) {
        queryClient.setQueryData(queryKeys.candidates(), context.previousCandidates)
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates() })
    }
  })

  // Generate CV report mutation
  const generateCVReport = useMutation<{ reportUrl: string; fileName: string }, Error, string>({
    mutationFn: CVService.generateCVReport,
    onError: (error) => {
      console.error('CV report generation failed:', error)
    }
  })

  return {
    uploadCV,
    useCandidates,
    useCVAnalysis,
    updateCandidateStatus,
    generateCVReport
  }
}